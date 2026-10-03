package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
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
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetTypeRepository;

@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.session_factory.statement_inspector="
                + "victor.training.petclinic.rest.RecordedSql",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListQueryBudgetTest {
    private static final int OWNERS_WITH_PETS = 24;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    @Autowired
    EntityManager entityManager;

    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void ownersWithPetsOfSeveralTypesAndVisits() {
        PetType cat = petTypeRepository.save(TestData.aPetType("budget-cat"));
        PetType dog = petTypeRepository.save(TestData.aPetType("budget-dog"));
        for (int i = 0; i < OWNERS_WITH_PETS; i++) {
            Owner owner = anOwner("Budget%02d".formatted(i));
            owner.addPet(aPetWithTwoVisits("Felix", cat));
            owner.addPet(aPetWithTwoVisits("Rex", dog));
            ownerRepository.save(owner);
        }
        ownerRepository.save(anOwner("Budget99NoPets"));
        entityManager.flush();
        entityManager.clear();
        RecordedSql.clear();
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void aColdFullPageTakesAtMostThreeSelects(int size) throws Exception {
        JsonNode page = list("/api/owners?lastName=Budget&size=" + size);

        assertThat(page.path("content")).hasSize(size);
        assertThat(RecordedSql.selects()).hasSizeLessThanOrEqualTo(3);
    }

    @Test
    void ownersArePagedByTheDatabaseBeforeTheirPetsAreLoaded() throws Exception {
        list("/api/owners?lastName=Budget&size=5&page=1");

        assertThat(RecordedSql.selects())
                .filteredOn(sql -> sql.contains(" offset ") && sql.contains(" fetch first "))
                .singleElement()
                .satisfies(pageQuery -> assertThat(pageQuery).doesNotContainPattern("\\bpets\\b"));
    }

    @Test
    void pageContentCarriesEveryPetTypeAndVisit() throws Exception {
        JsonNode content = list("/api/owners?lastName=Budget&size=20").path("content");

        content.forEach(owner -> {
            assertThat(owner.path("pets")).hasSize(2);
            owner.path("pets").forEach(pet -> {
                assertThat(pet.path("type").path("name").asText()).startsWith("budget-");
                assertThat(pet.path("visits")).hasSize(2);
            });
        });
    }

    @Test
    void ownersWithoutPetsAreIncluded() throws Exception {
        JsonNode content = list("/api/owners?lastName=Budget&size=5&sort=name,desc").path("content");

        assertThat(content.get(0).path("lastName").asText()).isEqualTo("Budget99NoPets");
        assertThat(content.get(0).path("pets")).isEmpty();
        assertThat(RecordedSql.selects()).hasSizeLessThanOrEqualTo(3);
    }

    @Test
    void anEmptyPageLoadsNoPetsOrVisits() throws Exception {
        JsonNode page = list("/api/owners?lastName=Budget&size=20&page=5");

        assertThat(page.path("content")).isEmpty();
        assertThat(RecordedSql.selects()).noneMatch(sql -> sql.matches("(?s).*\\b(pets|visits)\\b.*"));
    }

    private Owner anOwner(String lastName) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        return owner;
    }

    private Pet aPetWithTwoVisits(String name, PetType type) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setType(type);
        pet.addVisit(aVisit("first check-up", LocalDate.of(2024, 1, 10)));
        pet.addVisit(aVisit("vaccine", LocalDate.of(2024, 6, 10)));
        return pet;
    }

    private Visit aVisit(String description, LocalDate date) {
        Visit visit = new Visit();
        visit.setDescription(description);
        visit.setDate(date);
        return visit;
    }

    private JsonNode list(String uri) throws Exception {
        String json = mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }
}
