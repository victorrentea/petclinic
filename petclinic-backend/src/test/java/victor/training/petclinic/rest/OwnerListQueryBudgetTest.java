package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
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
import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;

/** Owner pagination must happen in SQL, before the pets/visits graph of the selected page is fetched. */
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListQueryBudgetTest {
    private static final int OWNERS = 45;
    private static final int PETS_PER_OWNER = 3;
    private static final int VISITS_PER_PET = 2;

    @Autowired
    MockMvc mockMvc;
    @Autowired
    EntityManager entityManager;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    Statistics statistics;

    @BeforeEach
    final void persistGraphAndClearState() {
        PetType cat = persist(TestData.aPetType("qbcat"));
        PetType dog = persist(TestData.aPetType("qbdog"));
        for (int i = 0; i < OWNERS; i++) {
            Owner owner = TestData.anOwner();
            owner.setLastName("Qbudget%02d".formatted(i));
            persist(owner);
            for (int p = 0; i % 5 != 0 && p < PETS_PER_OWNER; p++) { // every 5th owner has no pets
                persistPet(owner, p % 2 == 0 ? cat : dog);
            }
        }
        entityManager.flush();
        entityManager.clear();
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
    }

    @ParameterizedTest
    @CsvSource({"5, 'name,asc'", "20, 'name,asc'", "5, 'city,desc'", "20, 'name,desc'"})
    void fullPage_takesAtMostThreeSelects_includingSerialization(int size, String sort) throws Exception {
        JsonNode body = getJson("/api/owners?lastName=Qbudget&page=1&size=" + size + "&sort=" + sort);

        assertThat(body.get("content")).hasSize(size);
        assertThat(body.get("totalElements").asLong()).isEqualTo(OWNERS);
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
        assertThat(statistics.getCollectionFetchCount()).isZero();
        assertThat(statistics.getEntityStatistics(Owner.class.getName()).getLoadCount()).isLessThanOrEqualTo(size);
        assertNestedGraphComplete(body.get("content"));
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void pageBeyondLast_loadsNoPetsOrVisits(int size) throws Exception {
        JsonNode body = getJson("/api/owners?lastName=Qbudget&page=50&size=" + size);

        assertThat(body.get("content")).isEmpty();
        assertThat(statistics.getEntityLoadCount()).isZero();
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    private void assertNestedGraphComplete(JsonNode owners) {
        for (JsonNode owner : owners) {
            int index = Integer.parseInt(owner.get("lastName").asText().substring("Qbudget".length()));
            int expectedPets = index % 5 == 0 ? 0 : PETS_PER_OWNER;
            assertThat(owner.get("pets")).hasSize(expectedPets);
            for (JsonNode pet : owner.get("pets")) {
                assertThat(pet.get("type").get("name").asText()).startsWith("qb");
                assertThat(pet.get("visits")).hasSize(VISITS_PER_PET);
            }
        }
    }

    private void persistPet(Owner owner, PetType type) {
        Pet pet = TestData.aPet();
        pet.setType(type);
        pet.setOwner(owner);
        persist(pet);
        for (int v = 0; v < VISITS_PER_PET; v++) {
            Visit visit = new Visit();
            visit.setDescription("checkup " + v);
            visit.setDate(LocalDate.of(2024, 1, 1 + v));
            visit.setPet(pet);
            persist(visit);
        }
    }

    private <T> T persist(T entity) {
        entityManager.persist(entity);
        return entity;
    }

    private JsonNode getJson(String uri) throws Exception {
        String json = mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new ObjectMapper().readTree(json);
    }
}
