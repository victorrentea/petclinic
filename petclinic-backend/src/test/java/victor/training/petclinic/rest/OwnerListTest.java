package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.StreamSupport;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetTypeRepository;

@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        // paging a collection fetch in memory must fail the test, not just log a warning
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.cache.type=none"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {
    private static final String PREFIX = "Qpag";

    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetTypeRepository petTypeRepository;
    @Autowired
    EntityManager entityManager;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    private final ObjectMapper mapper = new ObjectMapper();

    // ---------- contract ----------

    @Test
    void defaultRequest_returnsFirstTenByNameAscWithTotal() throws Exception {
        JsonNode page = list(get("/api/owners"));

        assertThat(page.properties()).extracting(e -> e.getKey())
                .containsExactlyInAnyOrder("content", "totalElements");
        assertThat(page.path("content")).hasSize(10);
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
        assertThat(ids(page)).isEqualTo(ids(list(get("/api/owners?page=0&size=10&sort=name,asc"))));
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void acceptsAllowedSizes(int size) throws Exception {
        JsonNode page = list(get("/api/owners").param("size", "" + size));

        assertThat(page.path("content")).hasSize(size);
    }

    @Test
    void requestedPage_isTheMatchingSliceOfTheOrdering() throws Exception {
        List<Integer> firstTen = ids(list(get("/api/owners?size=10")));

        JsonNode secondPageOfFive = list(get("/api/owners?page=1&size=5"));

        assertThat(ids(secondPageOfFive)).isEqualTo(firstTen.subList(5, 10));
        assertThat(secondPageOfFive.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @Test
    void pageBeyondTheLast_isEmptyWithTheRealTotal() throws Exception {
        JsonNode page = list(get("/api/owners?page=999&size=20"));

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "size=7", "size=0", "size=-5", "size=abc",
            "page=-1", "page=abc", "page=1.5", "page=99999999999", "page=2147483647",
            "sort=lastName,asc", "sort=telephone,asc", "sort=name", "sort=name,up",
            "sort=name,asc&sort=city,asc"})
    void invalidInput_isBadRequest(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest());
    }

    @Test
    void lastNamePrefix_isCaseSensitiveAndAnchoredAtTheStart() throws Exception {
        assertThat(lastNames(list(get("/api/owners?lastName=Pot")))).containsExactly("Potter", "Potter");
        for (String noMatch : List.of("otter", "Harry", "potter")) {
            JsonNode page = list(get("/api/owners").param("lastName", noMatch));
            assertThat(page.path("content")).as(noMatch).isEmpty();
            assertThat(page.path("totalElements").asLong()).as(noMatch).isZero();
        }
    }

    @Test
    void filteredPage_countsTheFilteredSetOnly() throws Exception {
        for (int i = 0; i < 7; i++) {
            ownerRepository.save(owner("Qseven", "f" + i, "c"));
        }

        JsonNode page = list(get("/api/owners?lastName=Qseven&size=5&page=1"));

        assertThat(page.path("content")).hasSize(2);
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void wildcardsInThePrefix_matchLiterally() throws Exception {
        ownerRepository.save(owner("Qw%ld", "a", "c"));
        ownerRepository.save(owner("Qwxld", "b", "c"));
        ownerRepository.save(owner("Qw_ld", "c", "c"));
        ownerRepository.save(owner("Qwyld", "d", "c"));

        assertThat(lastNames(list(get("/api/owners").param("lastName", "Qw%")))).containsExactly("Qw%ld");
        assertThat(lastNames(list(get("/api/owners").param("lastName", "Qw_")))).containsExactly("Qw_ld");
    }

    @Test
    void emptyLastName_matchesAll() throws Exception {
        JsonNode page = list(get("/api/owners?lastName="));

        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count());
    }

    // ---------- ordering ----------

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "name,desc", "city,asc", "city,desc"})
    void traversingPages_followsTheBusinessKeyChain_withoutGapsOrDuplicates(String sort) throws Exception {
        List<Owner> fixture = persistFixture();
        Comparator<Owner> byName = Comparator.comparing(Owner::getLastName)
                .thenComparing(Owner::getFirstName)
                .thenComparing(Owner::getId);
        Comparator<Owner> chain = sort.startsWith("city")
                ? Comparator.comparing(Owner::getCity).thenComparing(byName)
                : byName;
        if (sort.endsWith("desc")) {
            chain = chain.reversed();
        }
        List<Integer> expected = fixture.stream().sorted(chain).map(Owner::getId).toList();

        List<Integer> traversed = new ArrayList<>();
        for (int pageIndex = 0; pageIndex < 6; pageIndex++) {
            JsonNode page = list(get("/api/owners").param("lastName", PREFIX)
                    .param("sort", sort).param("size", "5").param("page", "" + pageIndex));
            assertThat(page.path("totalElements").asLong()).isEqualTo(fixture.size());
            traversed.addAll(ids(page));
        }

        assertThat(traversed).isEqualTo(expected);
    }

    // ---------- bounded data access ----------

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void coldFullPage_takesAtMostThreeSelects_andCarriesTheFullNestedGraph(int size) throws Exception {
        persistFixture();
        Statistics statistics = coldStatistics();

        JsonNode page = list(get("/api/owners").param("lastName", PREFIX).param("size", "" + size));

        assertThat(page.path("content")).hasSize(size);
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
        assertThat(page.findValues("visits")).anyMatch(visits -> visits.size() > 1);
        for (JsonNode listed : page.path("content")) {
            coldStatistics();
            JsonNode detail = mapper.readTree(mockMvc.perform(get("/api/owners/{id}", listed.path("id").asInt()))
                    .andReturn().getResponse().getContentAsString());
            assertThat(listed).isEqualTo(detail);
        }
    }

    @Test
    void emptyPage_loadsNoAssociations() throws Exception {
        persistFixture();
        Statistics statistics = coldStatistics();

        JsonNode page = list(get("/api/owners").param("lastName", PREFIX).param("page", "99"));

        assertThat(page.path("content")).isEmpty();
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2); // page + count
    }

    /**
     * 25 owners under one prefix: three last names, two first names and two cities, so full
     * names and cities repeat and only the ID breaks ties. Owners hold 0-3 pets of two types,
     * each pet 0-2 visits.
     */
    private List<Owner> persistFixture() {
        PetType cat = petTypeRepository.save(TestData.aPetType("qcat"));
        PetType dog = petTypeRepository.save(TestData.aPetType("qdog"));
        List<Owner> owners = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            Owner owner = owner(PREFIX + "abc".charAt(i % 3), "xy".substring(i % 2, i % 2 + 1),
                    i % 4 < 2 ? "aville" : "bville");
            for (int p = 0; p < i % 4; p++) {
                Pet pet = new Pet();
                pet.setName("pet" + p);
                pet.setBirthDate(LocalDate.of(2020, 1, 1));
                pet.setType(p % 2 == 0 ? cat : dog);
                for (int v = 0; v < (p + 1) % 3; v++) {
                    Visit visit = new Visit();
                    visit.setDate(LocalDate.of(2024, 1, 1 + v));
                    visit.setDescription("visit" + v);
                    pet.addVisit(visit);
                }
                owner.addPet(pet);
            }
            owners.add(ownerRepository.save(owner));
        }
        return owners;
    }

    private Statistics coldStatistics() {
        entityManager.flush();
        entityManager.clear();
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        return statistics;
    }

    private static Owner owner(String lastName, String firstName, String city) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        owner.setFirstName(firstName);
        owner.setCity(city);
        return owner;
    }

    private JsonNode list(MockHttpServletRequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode page = mapper.readTree(json);
        assertThat(page.isObject()).as("a page envelope, not an array").isTrue();
        return page;
    }

    private static List<Integer> ids(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(o -> o.path("id").asInt()).toList();
    }

    private static List<String> lastNames(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(o -> o.path("lastName").asText()).toList();
    }
}
