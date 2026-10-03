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

/** GET /api/owners as a page: contract, validation, ordering and the SQL it costs. */
@SpringBootTest(properties = {
        // Paging a collection fetch in memory must blow up, not just log HHH90003004
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    EntityManager entityManager;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    private final ObjectMapper mapper = new ObjectMapper();

    // 7 owners whose last names start with "Z" — none in the seed does
    private int zanderAnn1;
    private int zanderAnn2;
    private int zanderBob;
    private int zeller;
    private int zimmer;
    private int zorn;
    private int zuse;

    @BeforeEach
    void insertZOwners() {
        PetType cat = persist(type("cat"));
        PetType dog = persist(type("dog"));
        zanderAnn1 = persistOwner("Ann", "Zander", "Berlin",
                pet("Alpha", cat, "rabies shot", "checkup"), pet("Beta", dog, "neutered"));
        zanderAnn2 = persistOwner("Ann", "Zander", "Berlin");
        zanderBob = persistOwner("Bob", "Zander", "Athens", pet("Gamma", dog));
        zeller = persistOwner("Cid", "Zeller", "Berlin");
        zimmer = persistOwner("Dan", "Zimmer", "Cairo");
        zorn = persistOwner("Eve", "Zorn", "Athens");
        zuse = persistOwner("Fay", "Zuse", "Dublin");
        entityManager.flush();
        entityManager.clear();
    }

    // ---------------------------------------------------------------- contract

    @Test
    void defaultRequest_returnsFirstTenByNameAndTheTotal() throws Exception {
        JsonNode page = getOk("/api/owners");

        assertThat(fieldNames(page)).containsExactly("content", "totalElements");
        assertThat(page.path("totalElements").asLong()).isEqualTo(26 + 7);
        assertThat(fullNames(page)).containsExactly(
                "Henry Baskerville", "Sam Carraclough", "George Darling", "Wendy Darling", "Charles Dickens",
                "John Dolittle", "Argus Filch", "Mister Geppetto", "Hermione Granger", "Rubeus Hagrid");
    }

    @Test
    void ownerInAPage_carriesTheSameNestedDataAsItsDetail() throws Exception {
        JsonNode page = getOk("/api/owners?lastName=Zander&sort=name,asc");

        JsonNode listed = page.path("content").get(0);
        assertThat(listed.path("id").asInt()).isEqualTo(zanderAnn1);
        assertThat(listed.path("pets")).hasSize(2);
        assertThat(listed.path("pets").get(0).path("visits")).hasSize(2);
        assertThat(listed.path("pets").get(0).path("type").path("name").asText()).isEqualTo("cat");
        assertThat(listed).isEqualTo(getOk("/api/owners/" + zanderAnn1));
    }

    @Test
    void ownersWithoutPetsAreListed() throws Exception {
        JsonNode page = getOk("/api/owners?lastName=Zimmer");

        assertThat(ids(page)).containsExactly(zimmer);
        assertThat(page.path("content").get(0).path("pets")).isEmpty();
    }

    // ---------------------------------------------------------------- paging

    @Test
    void requestedPage_isTheNextSliceOfTheSameOrder() throws Exception {
        JsonNode page = getOk("/api/owners?page=1&size=5");

        assertThat(fullNames(page)).containsExactly(
                "John Dolittle", "Argus Filch", "Mister Geppetto", "Hermione Granger", "Rubeus Hagrid");
        assertThat(page.path("totalElements").asLong()).isEqualTo(26 + 7);
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedSizes(int size) throws Exception {
        assertThat(getOk("/api/owners?size=" + size).path("content")).hasSize(size);
    }

    @Test
    void filteredPage_countsTheWholeFilteredSet() throws Exception {
        JsonNode page = getOk("/api/owners?lastName=Z&size=5&page=1");

        assertThat(ids(page)).containsExactly(zorn, zuse);
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void pageBeyondTheLast_isEmptyButKeepsTheTotal() throws Exception {
        JsonNode page = getOk("/api/owners?lastName=Z&size=5&page=1000000");

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "size=7", "size=0", "size=-5", "size=abc", "size=10.0",
            "page=-1", "page=abc", "page=1.5", "page=2147483648", "page=2147483647"})
    void invalidPaging_is400(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest());
    }

    // ---------------------------------------------------------------- sorting

    @Test
    void nameAscending_breaksTiesByIdAcrossPages() throws Exception {
        assertThat(traverse("lastName=Z&sort=name,asc"))
                .containsExactly(zanderAnn1, zanderAnn2, zanderBob, zeller, zimmer, zorn, zuse);
    }

    @Test
    void nameDescending_appliesTheDirectionToEveryTieBreaker() throws Exception {
        assertThat(traverse("lastName=Z&sort=name,desc"))
                .containsExactly(zuse, zorn, zimmer, zeller, zanderBob, zanderAnn2, zanderAnn1);
    }

    @Test
    void cityAscending_thenName() throws Exception {
        assertThat(traverse("lastName=Z&sort=city,asc"))
                .containsExactly(zanderBob, zorn, zanderAnn1, zanderAnn2, zeller, zimmer, zuse);
    }

    @Test
    void cityDescending_thenNameDescending() throws Exception {
        assertThat(traverse("lastName=Z&sort=city,desc"))
                .containsExactly(zuse, zimmer, zeller, zanderAnn2, zanderAnn1, zorn, zanderBob);
    }

    @Test
    void wholeDatasetIsTraversedWithoutDuplicatesOrGaps() throws Exception {
        List<Integer> ids = traverse("sort=city,desc");

        assertThat(ids).doesNotHaveDuplicates().hasSize(26 + 7);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "lastName,asc", "telephone,asc", "address,asc", "id,asc", "name", "name,up", "name,ASC,x",
            "Name,asc", "name,ASC", "name,asc&sort=city,asc", ",asc"})
    void unsupportedSort_is400(String sort) throws Exception {
        mockMvc.perform(get("/api/owners?sort=" + sort))
                .andExpect(status().isBadRequest());
    }

    // ---------------------------------------------------------------- filtering

    @Test
    void prefixIsCaseSensitiveAndAnchoredAtTheStartOfTheLastName() throws Exception {
        assertThat(fullNames(getOk("/api/owners?lastName=Pot")))
                .containsExactly("Beatrix Potter", "Harry Potter");
        for (String prefix : List.of("otter", "Harry", "potter")) {
            assertThat(getOk("/api/owners?lastName=" + prefix).path("totalElements").asLong())
                    .as(prefix).isZero();
        }
    }

    @Test
    void wildcardsInThePrefixAreLiteral() throws Exception {
        int percent = persistOwner("Per", "%Cent", "Rome");
        entityManager.flush();

        assertThat(ids(getOk(get("/api/owners").param("lastName", "%")))).containsExactly(percent);
        assertThat(getOk("/api/owners?lastName=Z_n").path("totalElements").asLong()).isZero();
    }

    @Test
    void noMatch_isAnEmptyPage() throws Exception {
        JsonNode page = getOk("/api/owners?lastName=NonExistent");

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isZero();
    }

    // ---------------------------------------------------------------- SQL budget

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void fullColdPage_costsAtMostThreeSelects(int size) throws Exception {
        for (int i = 0; i < 25; i++) {
            persistOwner("First" + i, "Budget" + i, "City" + i % 3,
                    pet("Cat" + i, persist(type("cat" + i)), "shot", "checkup"),
                    pet("Dog" + i, persist(type("dog" + i)), "neutered"));
        }
        entityManager.flush();
        entityManager.clear();
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        JsonNode page = getOk("/api/owners?lastName=Budget&size=" + size);

        assertThat(page.path("content")).hasSize(size);
        assertThat(page.path("content").get(size - 1).path("pets").get(0).path("visits")).hasSize(2);
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
    }

    @Test
    void emptyPage_loadsNoPetsNorVisits() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        getOk("/api/owners?lastName=Z&page=50");

        assertThat(statistics.getCollectionFetchCount()).isZero();
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    // ---------------------------------------------------------------- helpers

    private JsonNode getOk(String uri) throws Exception {
        return getOk(get(uri));
    }

    private JsonNode getOk(MockHttpServletRequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        entityManager.clear();
        return mapper.readTree(json);
    }

    /** Collects every page of size 5, in order. */
    private List<Integer> traverse(String query) throws Exception {
        List<Integer> all = new ArrayList<>();
        for (int pageIndex = 0;; pageIndex++) {
            JsonNode page = getOk("/api/owners?size=5&page=" + pageIndex + "&" + query);
            if (page.path("content").isEmpty()) {
                return all;
            }
            all.addAll(ids(page));
        }
    }

    private static List<Integer> ids(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(owner -> owner.path("id").asInt())
                .toList();
    }

    private static List<String> fullNames(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(owner -> owner.path("firstName").asText() + " " + owner.path("lastName").asText())
                .toList();
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private int persistOwner(String firstName, String lastName, String city, Pet... pets) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        for (Pet pet : pets) {
            owner.addPet(pet);
        }
        return persist(owner).getId();
    }

    private static Pet pet(String name, PetType type, String... visitDescriptions) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setType(type);
        for (int i = 0; i < visitDescriptions.length; i++) {
            Visit visit = new Visit();
            visit.setDescription(visitDescriptions[i]);
            visit.setDate(LocalDate.of(2025, 1, 1).plusDays(i));
            pet.addVisit(visit);
        }
        return pet;
    }

    private static PetType type(String name) {
        return TestData.aPetType(name);
    }

    private <T> T persist(T entity) {
        entityManager.persist(entity);
        return entity;
    }
}
