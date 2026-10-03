package victor.training.petclinic.rest;

import static java.util.Comparator.comparing;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
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
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.tools.SqlRecorder;

/**
 * Stable ordering across page boundaries, and the SQL a cold page costs. The fixture has duplicate
 * full names, shared cities, owners without pets and owners with several pets of different types,
 * each with visits — the shapes that break offset paging or multiply queries.
 */
@SpringBootTest(properties = {
        SqlRecorder.ACTIVATE,
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListPagingTest {
    private static final String PREFIX = "Qb";
    private static final int OWNERS = 24;
    private static final Comparator<Owner> BY_NAME = comparing(Owner::getLastName).thenComparing(Owner::getFirstName)
            .thenComparing(Owner::getId);
    private static final Comparator<Owner> BY_CITY = comparing(Owner::getCity).thenComparing(BY_NAME);

    @Autowired
    MockMvc mockMvc;
    @Autowired
    EntityManager entityManager;

    private final ObjectMapper mapper = new ObjectMapper();
    private final List<Owner> owners = new ArrayList<>();
    private final Map<Integer, Integer> petCountByOwnerId = new HashMap<>();

    @BeforeEach
    void persistFixture() {
        PetType cat = entityManager.getReference(PetType.class, 1);
        PetType dog = entityManager.getReference(PetType.class, 2);
        for (int i = 0; i < OWNERS; i++) {
            Owner owner = TestData.anOwner();
            owner.setLastName(PREFIX + "abcdef".charAt(i % 6)); // i and i+6 share a full name
            owner.setFirstName(i < OWNERS / 2 ? "Ann" : "Bob");
            owner.setCity("Cty" + i % 3);
            entityManager.persist(owner);
            int petCount = i % 3; // a third of the owners have no pet
            for (int p = 0; p < petCount; p++) {
                persistPetWithTwoVisits(owner, "Pet" + p, p % 2 == 0 ? cat : dog);
            }
            owners.add(owner);
            petCountByOwnerId.put(owner.getId(), petCount);
        }
        entityManager.flush();
        entityManager.clear();
        SqlRecorder.clear();
    }

    private void persistPetWithTwoVisits(Owner owner, String name, PetType type) {
        Pet pet = new Pet();
        pet.setName(name);
        pet.setBirthDate(LocalDate.of(2020, 1, 1));
        pet.setType(type);
        pet.setOwner(owner);
        entityManager.persist(pet);
        for (int v = 1; v <= 2; v++) {
            Visit visit = new Visit();
            visit.setDate(LocalDate.of(2024, v, 1));
            visit.setDescription("visit " + v);
            visit.setPet(pet);
            entityManager.persist(visit);
        }
    }

    @ParameterizedTest
    @CsvSource({
            "name,asc,5", "name,desc,5", "city,asc,5", "city,desc,5",
            "name,asc,20", "name,desc,20", "city,asc,20", "city,desc,20"})
    void traversingEveryPage_yieldsEachOwnerOnceInTheRequestedOrder(String key, String direction, int size)
            throws Exception {
        List<Integer> expected = owners.stream()
                .sorted(key.equals("name") ? BY_NAME : BY_CITY)
                .map(Owner::getId)
                .toList();
        if (direction.equals("desc")) {
            expected = expected.reversed();
        }

        List<Integer> traversed = new ArrayList<>();
        for (int page = 0; page * size < OWNERS; page++) {
            JsonNode body = list("lastName=" + PREFIX + "&sort=" + key + "," + direction
                    + "&size=" + size + "&page=" + page);
            assertThat(body.path("totalElements").asInt()).isEqualTo(OWNERS);
            body.path("content").forEach(owner -> traversed.add(owner.path("id").asInt()));
        }

        assertThat(traversed).containsExactlyElementsOf(expected);
    }

    @Test
    void everyOwnerOnAPageCarriesAllItsPetsTypesAndVisits() throws Exception {
        JsonNode content = list("lastName=" + PREFIX + "&size=20").path("content");

        assertThat(content).hasSize(20);
        for (JsonNode owner : content) {
            JsonNode pets = owner.path("pets");
            assertThat(pets).hasSize(petCountByOwnerId.get(owner.path("id").asInt()));
            for (JsonNode pet : pets) {
                assertThat(pet.path("type").path("name").asText()).isIn("cat", "dog");
                assertThat(pet.path("visits")).hasSize(2);
            }
        }
    }

    @ParameterizedTest
    @CsvSource({"20,0", "5,1", "5,3"})
    void aColdFullPage_costsAtMostThreeSelects_withPagingDoneByTheDatabase(int size, int page) throws Exception {
        JsonNode body = list("lastName=" + PREFIX + "&size=" + size + "&page=" + page);

        assertThat(body.path("content")).hasSize(size);
        List<String> selects = SqlRecorder.selects();
        assertThat(selects).hasSizeLessThanOrEqualTo(3);
        String pageQuery = selects.getFirst();
        assertThat(pageQuery).contains("from owners").doesNotContain("pets")
                .containsAnyOf("offset", "fetch first", "limit");
        assertThat(selects).filteredOn(sql -> sql.contains("pets"))
                .singleElement()
                .satisfies(graph -> assertThat(graph).doesNotContain("offset", "fetch first", "limit"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"lastName=" + PREFIX + "&page=9", "lastName=Nobody"})
    void anEmptyPage_loadsNoPetsOrVisits(String query) throws Exception {
        JsonNode body = list(query);

        assertThat(body.path("content")).isEmpty();
        assertThat(SqlRecorder.selects())
                .hasSizeLessThanOrEqualTo(2)
                .noneMatch(sql -> sql.contains("pets") || sql.contains("visits"));
    }

    private JsonNode list(String query) throws Exception {
        String json = mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }
}
