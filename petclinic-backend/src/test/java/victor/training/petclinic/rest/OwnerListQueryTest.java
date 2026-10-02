package victor.training.petclinic.rest;

import static java.util.Comparator.comparing;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

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
 * Ordering stability and the SQL budget of GET /api/owners. Statistics on, second-level and query
 * caches off, and in-memory pagination of a collection fetch turned from a warning into a failure.
 */
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=WARN"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListQueryTest {

    private static final Comparator<OwnerRow> BY_NAME = comparing(OwnerRow::lastName)
            .thenComparing(OwnerRow::firstName).thenComparing(OwnerRow::id);
    private static final Comparator<OwnerRow> BY_CITY = comparing(OwnerRow::city).thenComparing(BY_NAME);

    @Autowired
    MockMvc mockMvc;

    @Autowired
    EntityManager entityManager;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    private final ObjectMapper mapper = new ObjectMapper();

    private List<PetType> types;

    record OwnerRow(int id, String firstName, String lastName, String city) {
    }

    @BeforeEach
    void petTypes() {
        types = List.of(persistType("Qcat"), persistType("Qdog"), persistType("Qowl"));
    }

    @ParameterizedTest
    @CsvSource({"name,asc", "name,desc", "city,asc", "city,desc"})
    void traversingPages_visitsEveryOwnerOnceInTheRequestedOrder(String key, String direction) throws Exception {
        List<OwnerRow> fixture = orderingFixture();
        Comparator<OwnerRow> order = key.equals("name") ? BY_NAME : BY_CITY;
        if (direction.equals("desc")) {
            order = order.reversed();
        }
        coldPersistenceContext();

        List<OwnerRow> traversed = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            String sort = "&sort=" + key + "," + direction;
            JsonNode body = getJson("/api/owners?lastName=Qord&size=5" + sort + "&page=" + page);
            assertThat(body.path("totalElements").asLong()).isEqualTo(fixture.size());
            traversed.addAll(rows(body));
        }

        assertThat(traversed).containsExactlyElementsOf(fixture.stream().sorted(order).toList());
    }

    @Test
    void listedOwner_carriesTheSameNestedDataAsItsDetail() throws Exception {
        Owner rich = persistOwner("Rich", "Qnested", "Avon", 2, 2);
        persistOwner("Poor", "Qnested", "Avon", 0, 0);
        coldPersistenceContext();

        JsonNode content = getJson("/api/owners?lastName=Qnested&sort=name,desc").path("content");

        assertThat(content).hasSize(2);
        JsonNode listed = content.get(0);
        assertThat(listed.path("pets")).hasSize(2);
        assertThat(listed.path("pets").get(0).path("visits")).hasSize(2);
        assertThat(listed.path("pets").get(0).path("type").path("name").asText()).startsWith("Q");
        assertThat(listed).isEqualTo(getJson("/api/owners/" + rich.getId()));
        assertThat(content.get(1).path("pets")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void coldFullPage_takesAtMostThreeSelects(int size) throws Exception {
        for (int i = 0; i < 25; i++) {
            persistOwner("Ann", "Qbudget" + (char) ('a' + i), "Avon", 2, 2);
        }
        coldPersistenceContext();

        JsonNode body = getJson("/api/owners?lastName=Qbudget&size=" + size + "&page=" + (size == 5 ? 1 : 0));

        assertThat(body.path("content")).hasSize(size);
        assertThat(body.path("totalElements").asLong()).isEqualTo(25);
        assertThat(rows(body).getFirst().id()).isPositive();
        assertThat(body.path("content").get(0).path("pets").get(1).path("visits")).hasSize(2);
        assertThat(statistics().getPrepareStatementCount()).isLessThanOrEqualTo(3);
        assertThat(statistics().getEntityStatistics(Owner.class.getName()).getLoadCount())
                .as("owners hydrated: the database must apply LIMIT/OFFSET, not Java")
                .isEqualTo(size);
    }

    @ParameterizedTest
    @ValueSource(strings = {"lastName=Qnothing", "page=1000"})
    void emptyPage_loadsNoPetsOrVisits(String query) throws Exception {
        persistOwner("Ann", "Qempty", "Avon", 1, 1);
        coldPersistenceContext();

        JsonNode body = getJson("/api/owners?" + query);

        assertThat(body.path("content")).isEmpty();
        assertThat(statistics().getEntityStatistics(Pet.class.getName()).getLoadCount()).isZero();
        assertThat(statistics().getEntityStatistics(Visit.class.getName()).getLoadCount()).isZero();
        assertThat(statistics().getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    /** Duplicate full names, shared cities, and owners without pets, so every tie-breaker matters. */
    private List<OwnerRow> orderingFixture() {
        String[][] owners = {
                {"Bob", "Qordb", "Bath"}, {"Ann", "Qorda", "Bath"}, {"Ann", "Qorda", "Avon"},
                {"Ann", "Qorda", "Bath"}, {"Bob", "Qorda", "Avon"}, {"Ann", "Qordc", "Avon"},
                {"Bob", "Qordb", "Bath"}, {"Ann", "Qordb", "Avon"}, {"Bob", "Qordc", "Bath"},
                {"Ann", "Qorda", "Avon"}, {"Bob", "Qordb", "Avon"}, {"Ann", "Qordc", "Bath"}};
        List<OwnerRow> rows = new ArrayList<>();
        for (int i = 0; i < owners.length; i++) {
            Owner owner = persistOwner(owners[i][0], owners[i][1], owners[i][2], i % 3, i % 2);
            rows.add(new OwnerRow(owner.getId(), owner.getFirstName(), owner.getLastName(), owner.getCity()));
        }
        return rows;
    }

    private Owner persistOwner(String firstName, String lastName, String city, int petCount, int visitsPerPet) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        entityManager.persist(owner);
        for (int p = 0; p < petCount; p++) {
            Pet pet = TestData.aPet();
            pet.setName("Pet" + p);
            pet.setType(types.get(p % types.size()));
            owner.addPet(pet);
            entityManager.persist(pet);
            for (int v = 0; v < visitsPerPet; v++) {
                Visit visit = new Visit();
                visit.setDate(LocalDate.of(2024, 1, 1 + v));
                visit.setDescription("Visit " + v);
                pet.addVisit(visit);
                entityManager.persist(visit);
            }
        }
        return owner;
    }

    private PetType persistType(String name) {
        PetType type = TestData.aPetType(name);
        entityManager.persist(type);
        return type;
    }

    private void coldPersistenceContext() {
        entityManager.flush();
        entityManager.clear();
        statistics().clear();
    }

    private Statistics statistics() {
        return entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    }

    private JsonNode getJson(String uri) throws Exception {
        return mapper.readTree(mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private static List<OwnerRow> rows(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(o -> new OwnerRow(o.path("id").asInt(), o.path("firstName").asText(),
                        o.path("lastName").asText(), o.path("city").asText()))
                .toList();
    }
}
