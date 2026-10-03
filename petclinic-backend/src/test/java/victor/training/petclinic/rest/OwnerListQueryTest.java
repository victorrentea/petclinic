package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;

// Not @Transactional: fixtures are committed through JDBC, so every request starts with an empty
// persistence context and the statement counts below are those of a cold page.
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false",
})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListQueryTest {
    private static final String PREFIX = "Qz";
    private static final List<String> LAST_NAMES = List.of("Qzalpha", "Qzbravo", "Qzcharlie", "Qzdelta", "Qzecho",
            "Qzfoxtrot");
    private static final List<String> FIRST_NAMES = List.of("Ann", "Bob", "Cid", "Dan");
    private static final List<String> CITIES = List.of("Aberdeen", "Bath", "Cork");
    private static final int OWNERS = 24; // every full name twice, every city 8 times

    record FixtureOwner(int id, String firstName, String lastName, String city, Map<String, Integer> visitsByPet,
            Map<String, String> typeByPet) {
    }

    @Autowired
    MockMvc mockMvc;
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    private final ObjectMapper mapper = new ObjectMapper();
    private final List<FixtureOwner> fixture = new ArrayList<>();

    @BeforeEach
    void insertFixture() {
        for (int i = 0; i < OWNERS; i++) {
            fixture.add(insertOwner(i));
        }
    }

    @AfterEach
    void deleteFixture() {
        jdbc.update(
                "DELETE FROM visits WHERE pet_id IN (SELECT p.id FROM pets p JOIN owners o ON o.id = p.owner_id WHERE o.last_name LIKE 'Qz%')");
        jdbc.update("DELETE FROM pets WHERE owner_id IN (SELECT id FROM owners WHERE last_name LIKE 'Qz%')");
        jdbc.update("DELETE FROM owners WHERE last_name LIKE 'Qz%'");
    }

    @ParameterizedTest
    @CsvSource({"name,asc", "name,desc", "city,asc", "city,desc"})
    void traversingPages_visitsEveryOwnerOnceInTheBusinessOrder(String key, String direction) throws Exception {
        List<Integer> traversed = new ArrayList<>();
        for (int page = 0; page * 5 < OWNERS; page++) {
            traversed.addAll(ids(listOwners(page, 5, key + "," + direction)));
        }

        assertThat(traversed).containsExactlyElementsOf(expectedIds(key, direction));
    }

    @Test
    void pageOwners_carryTheirFullPetTypeAndVisitGraph() throws Exception {
        JsonNode page = listOwners(0, 20, "name,asc");

        assertThat(page.path("content")).hasSize(20);
        Map<Integer, FixtureOwner> byId = new HashMap<>();
        fixture.forEach(o -> byId.put(o.id(), o));
        for (JsonNode owner : page.path("content")) {
            FixtureOwner expected = byId.get(owner.path("id").asInt());
            Map<String, Integer> visitsByPet = new HashMap<>();
            Map<String, String> typeByPet = new HashMap<>();
            owner.path("pets").forEach(pet -> {
                visitsByPet.put(pet.path("name").asText(), pet.path("visits").size());
                typeByPet.put(pet.path("name").asText(), pet.path("type").path("name").asText());
            });
            assertThat(visitsByPet).as("visits of " + expected).isEqualTo(expected.visitsByPet());
            assertThat(typeByPet).as("types of " + expected).isEqualTo(expected.typeByPet());
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void aFullColdPage_takesAtMostThreeSelects_andLoadsOnlyItsOwners(int size) throws Exception {
        Statistics statistics = statistics();

        JsonNode page = listOwners(0, size, "city,desc");

        assertThat(page.path("content").size()).isEqualTo(size);
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
        assertThat(statistics.getEntityStatistics(Owner.class.getName()).getLoadCount())
                .isEqualTo(page.path("content").size());
    }

    @Test
    void anEmptyPage_loadsNoPets() throws Exception {
        Statistics statistics = statistics();

        JsonNode page = listOwners(100, 20, "name,asc");

        assertThat(page.path("content").isEmpty()).isTrue();
        assertThat(page.path("totalElements").asLong()).isEqualTo(OWNERS);
        assertThat(statistics.getEntityStatistics(Pet.class.getName()).getLoadCount()).isZero();
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    private Statistics statistics() {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        return statistics;
    }

    private JsonNode listOwners(int page, int size, String sort) throws Exception {
        String json = mockMvc.perform(get("/api/owners")
                .param("lastName", PREFIX)
                .param("page", String.valueOf(page))
                .param("size", String.valueOf(size))
                .param("sort", sort))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<Integer> ids(JsonNode page) {
        List<Integer> ids = new ArrayList<>();
        page.path("content").forEach(owner -> ids.add(owner.path("id").asInt()));
        return ids;
    }

    private List<Integer> expectedIds(String key, String direction) {
        Comparator<FixtureOwner> byName = Comparator.comparing(FixtureOwner::lastName)
                .thenComparing(FixtureOwner::firstName)
                .thenComparing(FixtureOwner::id);
        Comparator<FixtureOwner> order = key.equals("city")
                ? Comparator.comparing(FixtureOwner::city).thenComparing(byName)
                : byName;
        if (direction.equals("desc")) {
            order = order.reversed();
        }
        return fixture.stream().sorted(order).map(FixtureOwner::id).toList();
    }

    // Every third owner has no pets; the next a bird without visits; the next a cat and a dog, two visits each.
    private FixtureOwner insertOwner(int i) {
        String firstName = FIRST_NAMES.get(i % FIRST_NAMES.size());
        String lastName = LAST_NAMES.get(i % LAST_NAMES.size());
        String city = CITIES.get(i % CITIES.size());
        int ownerId = jdbc.queryForObject("INSERT INTO owners (first_name, last_name, address, city, telephone)"
                + " VALUES (?, ?, 'addr', ?, '0000000000') RETURNING id", Integer.class, firstName, lastName, city);
        Map<String, Integer> visitsByPet = new HashMap<>();
        Map<String, String> typeByPet = new HashMap<>();
        if (i % 3 == 1) {
            insertPet(ownerId, "Tweety" + i, "bird", 0, visitsByPet, typeByPet);
        } else if (i % 3 == 2) {
            insertPet(ownerId, "Felix" + i, "cat", 2, visitsByPet, typeByPet);
            insertPet(ownerId, "Rex" + i, "dog", 2, visitsByPet, typeByPet);
        }
        return new FixtureOwner(ownerId, firstName, lastName, city, visitsByPet, typeByPet);
    }

    private void insertPet(int ownerId, String name, String type, int visits,
            Map<String, Integer> visitsByPet, Map<String, String> typeByPet) {
        int petId = jdbc.queryForObject("INSERT INTO pets (name, birth_date, type_id, owner_id)"
                + " VALUES (?, ?, (SELECT id FROM types WHERE name = ?), ?) RETURNING id",
                Integer.class, name, LocalDate.of(2020, 1, 1), type, ownerId);
        for (int v = 0; v < visits; v++) {
            jdbc.update("INSERT INTO visits (pet_id, visit_date, description) VALUES (?, ?, ?)",
                    petId, LocalDate.of(2024, 1, 1 + v), "check-up " + v);
        }
        visitsByPet.put(name, visits);
        typeByPet.put(name, type);
    }
}
