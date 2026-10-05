package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;

/**
 * Listing a page must cost the same few SELECTs however many owners match or pets they own:
 * the owner page, its count, and one fetch of the selected owners' pets, types and visits.
 * Counted from a cold persistence context through JSON serialization, with Hibernate told to
 * fail rather than page a collection fetch in memory.
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

    private static final int MATCHING_OWNERS = 25;

    @Autowired
    MockMvc mockMvc;
    @Autowired
    EntityManager entityManager;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    private final ObjectMapper mapper = new ObjectMapper();
    private Statistics statistics;

    @BeforeEach
    void ownersWithSeveralPetsTypesAndVisits() {
        PetType cat = entityManager.find(PetType.class, 1);
        PetType dog = entityManager.find(PetType.class, 2);
        for (int i = 0; i < MATCHING_OWNERS; i++) {
            Owner owner = TestData.anOwner();
            owner.setLastName("Qbudget" + (char) ('a' + i));
            owner.addPet(pet("Cat" + i, cat));
            owner.addPet(pet("Dog" + i, dog));
            entityManager.persist(owner);
        }
        entityManager.flush();
        entityManager.clear();
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
    }

    @ParameterizedTest
    @CsvSource({"5, name,asc", "10, city,desc", "20, name,desc"})
    void aFullPage_costsAtMostThreeSelects(int size, String sortKey, String direction) throws Exception {
        JsonNode page = list("/api/owners?lastName=Qbudget&size=" + size + "&sort=" + sortKey + "," + direction);

        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
        assertThat(page.get("content")).hasSize(size);
        assertThat(page.get("totalElements").asInt()).isEqualTo(MATCHING_OWNERS);
        page.get("content").forEach(owner -> {
            assertThat(owner.get("pets")).hasSize(2);
            owner.get("pets").forEach(pet -> {
                assertThat(pet.get("visits")).hasSize(2);
                assertThat(pet.get("type").get("name").asText()).isIn("cat", "dog");
            });
        });
    }

    @Test
    void onlyTheSelectedOwnersAreLoaded() throws Exception {
        list("/api/owners?lastName=Qbudget&size=5");

        assertThat(statistics.getEntityStatistics(Owner.class.getName()).getLoadCount()).isEqualTo(5);
        assertThat(statistics.getEntityStatistics(Pet.class.getName()).getLoadCount()).isEqualTo(10);
    }

    @Test
    void anEmptyPage_loadsNoPetsOrVisits() throws Exception {
        JsonNode page = list("/api/owners?lastName=Qbudget&page=50");

        assertThat(page.get("content")).isEmpty();
        assertThat(page.get("totalElements").asInt()).isEqualTo(MATCHING_OWNERS);
        assertThat(statistics.getEntityStatistics(Pet.class.getName()).getLoadCount()).isZero();
        assertThat(statistics.getEntityStatistics(Visit.class.getName()).getLoadCount()).isZero();
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    @Test
    void noMatch_loadsNoPetsOrVisits() throws Exception {
        JsonNode page = list("/api/owners?lastName=Qnobody");

        assertThat(page.get("totalElements").asInt()).isZero();
        assertThat(statistics.getEntityStatistics(Pet.class.getName()).getLoadCount()).isZero();
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
    }

    private JsonNode list(String uri) throws Exception {
        return mapper.readTree(mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private static Pet pet(String name, PetType type) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setType(type);
        pet.addVisit(visit("2024-01-02"));
        pet.addVisit(visit("2024-06-07"));
        return pet;
    }

    private static Visit visit(String date) {
        Visit visit = new Visit();
        visit.setDate(LocalDate.parse(date));
        visit.setDescription("checkup");
        return visit;
    }
}
