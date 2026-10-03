package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
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

/**
 * Stable ordering across page boundaries, and a bounded number of SELECTs for a cold page:
 * the persistence context is cleared after the fixture, no second-level/query cache, and
 * Hibernate fails instead of paging a collection fetch in memory.
 */
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListQueryBudgetTest {
    private static final String PREFIX = "Zq";
    private static final int MATCHING_OWNERS = 25;

    @Autowired
    MockMvc mockMvc;
    @Autowired
    EntityManager em;
    @Autowired
    EntityManagerFactory emf;
    @Autowired
    JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();
    private final List<Integer> twinIds = new ArrayList<>();
    private int ownerWithPetsId;
    private int ownerWithoutPetsId;

    @BeforeEach
    void persistOwnersThenClearTheContext() {
        PetType cat = persist(TestData.aPetType("zq-cat"));
        PetType dog = persist(TestData.aPetType("zq-dog"));
        String[] cities = {"Ankara", "Bergen", "Cork"};
        for (int i = 0; i < MATCHING_OWNERS - 4; i++) {
            Owner owner = owner("First" + (char) ('A' + i % 5), PREFIX + (char) ('A' + i % 7), cities[i % 3]);
            if (i % 2 == 0) {
                addPet(owner, "Pet" + i, i % 4 == 0 ? cat : dog, 2);
                addPet(owner, "Other" + i, dog, 1);
            }
        }
        for (int i = 0; i < 3; i++) { // same full name, same city: only the ID tells them apart
            twinIds.add(owner("Ann", PREFIX + "Twin", "Bergen").getId());
        }
        Owner rich = owner("Rich", PREFIX + "Pets", "Cork");
        addPet(rich, "Alpha", cat, 3);
        addPet(rich, "Beta", dog, 2);
        ownerWithPetsId = rich.getId();
        ownerWithoutPetsId = twinIds.get(0);

        em.flush();
        em.clear();
        statistics().clear();
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void fullColdPage_takesAtMostThreeSelects_andLoadsOnlyThatPageOfOwners(int size) throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", PREFIX).param("size", String.valueOf(size)));

        assertThat(page.path("content")).hasSize(size);
        assertThat(page.path("totalElements").asInt()).isEqualTo(MATCHING_OWNERS);
        assertThat(statistics().getPrepareStatementCount()).isLessThanOrEqualTo(3);
        assertThat(statistics().getEntityStatistics(Owner.class.getName()).getLoadCount()).isEqualTo(size);
    }

    @Test
    void emptyPage_loadsNoPetsOrVisits() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", PREFIX).param("page", "50"));

        assertThat(page.path("content")).isEmpty();
        assertThat(statistics().getEntityStatistics(Pet.class.getName()).getLoadCount()).isZero();
        assertThat(statistics().getEntityStatistics(Visit.class.getName()).getLoadCount()).isZero();
        assertThat(statistics().getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "name,desc", "city,asc", "city,desc"})
    void traversingPages_visitsEveryOwnerOnceInOrder(String sort) throws Exception {
        List<Integer> traversed = new ArrayList<>();
        for (int pageIndex = 0; pageIndex * 5 < MATCHING_OWNERS; pageIndex++) {
            traversed.addAll(ids(list(get("/api/owners").param("lastName", PREFIX)
                    .param("sort", sort).param("size", "5").param("page", String.valueOf(pageIndex)))));
        }

        assertThat(traversed).isEqualTo(expectedOrder(sort));
    }

    @ParameterizedTest
    @ValueSource(strings = {"asc", "desc"})
    void identicalNames_areOrderedByIdInTheRequestedDirection(String direction) throws Exception {
        List<Integer> twins = ids(list(get("/api/owners").param("lastName", PREFIX + "Twin")
                .param("sort", "name," + direction)));

        List<Integer> expected = new ArrayList<>(twinIds);
        if (direction.equals("desc")) {
            expected = expected.reversed();
        }
        assertThat(twins).isEqualTo(expected);
    }

    @Test
    void listedOwners_carryTheSameNestedDataAsTheDetailEndpoint() throws Exception {
        JsonNode page = list(get("/api/owners").param("lastName", PREFIX).param("sort", "name,desc"));
        em.clear();

        for (int id : List.of(ownerWithPetsId, ownerWithoutPetsId)) {
            JsonNode listed = StreamSupport.stream(page.path("content").spliterator(), false)
                    .filter(o -> o.path("id").asInt() == id)
                    .findFirst().orElseThrow();
            assertThat(listed).isEqualTo(list(get("/api/owners/{id}", id)));
        }
        assertThat(page.toString()).contains("zq-cat", "zq-dog", "visit 3 of Alpha");
    }

    private List<Integer> expectedOrder(String sort) {
        String direction = sort.endsWith("desc") ? " DESC" : "";
        String chain = (sort.startsWith("city") ? "city%1$s, " : "") + "last_name%1$s, first_name%1$s, id%1$s";
        return jdbc.queryForList("SELECT id FROM owners WHERE last_name LIKE '" + PREFIX + "%' ORDER BY "
                + chain.formatted(direction), Integer.class);
    }

    private Owner owner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return persist(owner);
    }

    private void addPet(Owner owner, String name, PetType type, int visits) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setType(type);
        owner.addPet(pet);
        persist(pet);
        for (int v = 1; v <= visits; v++) {
            Visit visit = new Visit();
            visit.setDate(LocalDate.of(2024, 1, v));
            visit.setDescription("visit " + v + " of " + name);
            pet.addVisit(visit);
            persist(visit);
        }
    }

    private <T> T persist(T entity) {
        em.persist(entity);
        return entity;
    }

    private Statistics statistics() {
        return emf.unwrap(SessionFactory.class).getStatistics();
    }

    private JsonNode list(MockHttpServletRequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<Integer> ids(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(o -> o.path("id").asInt())
                .toList();
    }
}
