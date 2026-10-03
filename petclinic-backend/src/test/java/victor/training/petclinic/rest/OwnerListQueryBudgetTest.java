package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;

/** Guards the owner list against N+1 and in-memory pagination: page first, then fetch the graph of that page only. */
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.session_factory.statement_inspector="
                + "victor.training.petclinic.rest.SqlStatementRecorder",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false",
})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListQueryBudgetTest {
    private static final int MATCHING_OWNERS = 45;
    private static final int PETS_PER_OWNER = 2;
    private static final int VISITS_PER_PET = 2;

    @Autowired
    MockMvc mockMvc;
    @Autowired
    EntityManager entityManager;

    final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void persistOwnersWithPetsAndVisits() {
        PetType cat = persistedType("zq-cat");
        PetType dog = persistedType("zq-dog");
        for (int i = 0; i < MATCHING_OWNERS; i++) {
            Owner owner = TestData.anOwner();
            owner.setLastName("Zqb%02d".formatted(i));
            entityManager.persist(owner);
            for (int p = 0; p < PETS_PER_OWNER; p++) {
                persistPetWithVisits(owner, p % 2 == 0 ? cat : dog, "Pet" + p);
            }
        }
        entityManager.flush();
        entityManager.clear();
        SqlStatementRecorder.reset();
    }

    @ParameterizedTest(name = "page {0} of size {1}")
    @CsvSource({"0, 5", "0, 20", "1, 20", "1, 5"})
    void aFullPage_takesAtMostThreeSelects_pagedByTheDatabaseBeforeLoadingPets(int page, int size) throws Exception {
        JsonNode response = mapper.readTree(mockMvc.perform(get("/api/owners")
                .param("lastName", "Zqb").param("page", String.valueOf(page)).param("size", String.valueOf(size)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        List<String> selects = SqlStatementRecorder.selects();
        assertThat(selects).as("SQL SELECTs through serialization").hasSizeLessThanOrEqualTo(3);
        int pageQuery = firstIndexMatching(selects, "fetch first|limit");
        int petsQuery = firstIndexMatching(selects, "\\bpets\\b");
        assertThat(pageQuery).as("the owners page is limited in SQL").isNotEqualTo(Integer.MAX_VALUE);
        assertThat(petsQuery).as("pets are loaded by a query of their own").isNotEqualTo(Integer.MAX_VALUE);
        assertThat(pageQuery).as("the page is limited before any pet is loaded").isLessThan(petsQuery);
        assertThat(response.path("totalElements").asInt()).isEqualTo(MATCHING_OWNERS);
        assertThat(response.path("content")).hasSize(size);
        for (JsonNode owner : response.path("content")) {
            assertThat(owner.path("pets")).hasSize(PETS_PER_OWNER);
            for (JsonNode pet : owner.path("pets")) {
                assertThat(pet.path("type").path("name").asText()).startsWith("zq-");
                assertThat(pet.path("visits")).hasSize(VISITS_PER_PET);
            }
        }
    }

    private static int firstIndexMatching(List<String> statements, String regex) {
        for (int i = 0; i < statements.size(); i++) {
            if (statements.get(i).toLowerCase().matches("(?s).*(" + regex + ").*")) {
                return i;
            }
        }
        return Integer.MAX_VALUE;
    }

    private PetType persistedType(String name) {
        PetType type = TestData.aPetType(name);
        entityManager.persist(type);
        return type;
    }

    private void persistPetWithVisits(Owner owner, PetType type, String name) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setType(type);
        owner.addPet(pet);
        entityManager.persist(pet);
        for (int v = 0; v < VISITS_PER_PET; v++) {
            Visit visit = new Visit();
            visit.setDate(LocalDate.of(2024, 1, 1 + v));
            visit.setDescription("visit " + v);
            pet.addVisit(visit);
            entityManager.persist(visit);
        }
    }
}
