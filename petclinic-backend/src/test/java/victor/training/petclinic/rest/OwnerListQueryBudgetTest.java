package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;

/**
 * Cold reads of the owner list: rows are inserted over plain JDBC and the test is NOT @Transactional,
 * so no persistence context or cache already holds them when the request runs. Every statement
 * Hibernate prepares between the request and the serialized JSON is counted.
 */
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false",
})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListQueryBudgetTest {

    private static final String PREFIX = "Zq";
    private static final int OWNERS = 25;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void insertOwnersWithTiesAndNestedData() {
        int catId = jdbc.queryForObject("SELECT id FROM types WHERE name = 'cat'", Integer.class);
        int dogId = jdbc.queryForObject("SELECT id FROM types WHERE name = 'dog'", Integer.class);
        for (int i = 0; i < OWNERS; i++) {
            // every 5 owners share one full name and every 3 one city: ties the ID must break
            String lastName = PREFIX + "name" + (char) ('a' + i / 5);
            String city = "City" + (i % 3);
            Integer ownerId = jdbc.queryForObject(
                    "INSERT INTO owners (first_name, last_name, address, city, telephone)" +
                            " VALUES ('Same', ?, 'addr', ?, '0000000000') RETURNING id",
                    Integer.class, lastName, city);
            if (i % 4 == 0) {
                continue; // an owner without pets
            }
            for (int p = 0; p < 2; p++) {
                Integer petId = jdbc.queryForObject(
                        "INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES (?, ?, ?, ?) RETURNING id",
                        Integer.class, "Pet" + i + "_" + p, LocalDate.of(2020, 1, 1), p == 0 ? catId : dogId, ownerId);
                for (int v = 0; v < 2; v++) {
                    jdbc.update("INSERT INTO visits (pet_id, visit_date, description) VALUES (?, ?, ?)",
                            petId, LocalDate.of(2024, 1, 1 + v), "visit " + v);
                }
            }
        }
    }

    @AfterEach
    void deleteFixtures() {
        jdbc.update("DELETE FROM visits WHERE pet_id IN (SELECT p.id FROM pets p JOIN owners o ON p.owner_id = o.id" +
                " WHERE o.last_name LIKE 'Zq%')");
        jdbc.update("DELETE FROM pets WHERE owner_id IN (SELECT id FROM owners WHERE last_name LIKE 'Zq%')");
        jdbc.update("DELETE FROM owners WHERE last_name LIKE 'Zq%'");
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void fullColdPage_takesAtMostThreeStatementsThroughSerialization(int size) throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        JsonNode page = getOk("/api/owners?lastName=" + PREFIX + "&size=" + size);

        assertThat(page.path("content")).hasSize(size);
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
        assertThat(statistics.getCollectionFetchCount()).as("lazy collection loads").isZero();
    }

    @Test
    void emptyPage_loadsNoPetsOrVisits() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        JsonNode page = getOk("/api/owners?lastName=" + PREFIX + "&page=100");

        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asInt()).isEqualTo(OWNERS);
        assertThat(statistics.getEntityLoadCount()).isZero();
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    @Test
    void selectedOwnersCarryAllTheirPetsTypesAndVisits() throws Exception {
        JsonNode page = getOk("/api/owners?lastName=" + PREFIX + "&size=20");

        for (JsonNode owner : page.path("content")) {
            int ownerId = owner.path("id").asInt();
            List<Map<String, Object>> pets = jdbc.queryForList(
                    "SELECT p.id, t.name AS type, (SELECT count(*) FROM visits v WHERE v.pet_id = p.id) AS visits" +
                            " FROM pets p JOIN types t ON t.id = p.type_id WHERE p.owner_id = ?",
                    ownerId);
            assertThat(owner.path("pets")).hasSize(pets.size());
            for (JsonNode pet : owner.path("pets")) {
                Map<String, Object> expected = pets.stream()
                        .filter(row -> ((Number) row.get("id")).intValue() == pet.path("id").asInt())
                        .findFirst().orElseThrow();
                assertThat(pet.path("type").path("name").asText()).isEqualTo(expected.get("type"));
                assertThat(pet.path("visits")).hasSize(((Number) expected.get("visits")).intValue());
            }
        }
    }

    @ParameterizedTest
    @CsvSource({
            "name,asc,  'last_name, first_name, id'",
            "name,desc, 'last_name DESC, first_name DESC, id DESC'",
            "city,asc,  'city, last_name, first_name, id'",
            "city,desc, 'city DESC, last_name DESC, first_name DESC, id DESC'",
    })
    void traversingPages_visitsEveryOwnerOnceInOrder(String key, String direction, String orderBy) throws Exception {
        List<Integer> expected = jdbc.queryForList(
                "SELECT id FROM owners WHERE last_name LIKE 'Zq%' ORDER BY " + orderBy, Integer.class);

        for (int size : new int[]{5, 20}) {
            List<Integer> traversed = new ArrayList<>();
            for (int pageIndex = 0; pageIndex * size < OWNERS; pageIndex++) {
                JsonNode page = getOk("/api/owners?lastName=" + PREFIX + "&size=" + size + "&page=" + pageIndex
                        + "&sort=" + key + "," + direction);
                assertThat(page.path("totalElements").asInt()).isEqualTo(OWNERS);
                page.path("content").forEach(o -> traversed.add(o.path("id").asInt()));
            }
            assertThat(traversed).as("size %d", size).containsExactlyElementsOf(expected);
        }
    }

    @Test
    void identicalFullNames_areOrderedByIdInTheRequestedDirection() throws Exception {
        List<Integer> ascending = ids(getOk("/api/owners?lastName=" + PREFIX + "namea&sort=name,asc"));
        List<Integer> descending = ids(getOk("/api/owners?lastName=" + PREFIX + "namea&sort=name,desc"));

        assertThat(ascending).hasSize(5).isSorted();
        assertThat(descending).containsExactlyElementsOf(ascending.reversed());
    }

    private JsonNode getOk(String uri) throws Exception {
        String json = mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<Integer> ids(JsonNode page) {
        List<Integer> ids = new ArrayList<>();
        page.path("content").forEach(o -> ids.add(o.path("id").asInt()));
        return ids;
    }
}
