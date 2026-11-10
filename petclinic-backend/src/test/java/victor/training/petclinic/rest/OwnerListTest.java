package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import victor.training.petclinic.DefaultFixture;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;

/** GET /api/owners: one page at a time. The seed ({@link DefaultFixture}) holds 26 owners. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {

    @Autowired
    MockMvc mockMvc;
    @Autowired
    ObjectMapper mapper;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetRepository petRepository;
    @Autowired
    PetTypeRepository petTypeRepository;
    @Autowired
    EntityManager entityManager;

    @Test
    @DefaultFixture
    void firstPageByDefault() throws Exception {
        JsonNode response = list("/api/owners");

        assertThat(response.path("content")).hasSize(10);
        assertThat(response.path("page").toString())
                .isEqualTo("{\"size\":10,\"number\":0,\"totalElements\":26,\"totalPages\":3}");
    }

    @Test
    @DefaultFixture
    void aLaterPage() throws Exception {
        JsonNode response = list("/api/owners?page=2&size=10");

        assertThat(response.path("content")).hasSize(6);
        assertThat(response.path("page").path("number").asInt()).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    @DefaultFixture
    void allowedSizes(int size) throws Exception {
        JsonNode response = list("/api/owners?size=" + size);

        assertThat(response.path("content")).hasSize(size);
        assertThat(response.path("page").path("size").asInt()).isEqualTo(size);
    }

    @Test
    @DefaultFixture
    void oversizedPageIsClampedTo20() throws Exception {
        JsonNode response = list("/api/owners?size=50000");

        assertThat(response.path("content")).hasSize(20);
        assertThat(response.path("page").path("size").asInt()).isEqualTo(20);
    }

    @Test
    @DefaultFixture
    void aPagePastTheEndIsEmpty() throws Exception {
        JsonNode response = list("/api/owners?page=99");

        assertThat(response.path("content")).isEmpty();
        assertThat(response.path("page").path("totalElements").asInt()).isEqualTo(26);
        assertThat(response.path("page").path("totalPages").asInt()).isEqualTo(3);
    }

    @Test
    @DefaultFixture
    void filteredTotalsCountOnlyMatchingOwners() throws Exception {
        JsonNode response = list("/api/owners?lastName=Potter&size=5");

        assertThat(lastNames(response)).containsExactly("Potter", "Potter");
        assertThat(response.path("page").path("totalElements").asInt()).isEqualTo(2);
    }

    @Test
    void noMatch() throws Exception {
        JsonNode response = list("/api/owners?lastName=Zzzz");

        assertThat(response.path("content").isArray()).isTrue();
        assertThat(response.path("content")).isEmpty();
        assertThat(response.path("page").path("totalElements").isInt()).isTrue();
        assertThat(response.path("page").path("totalElements").asInt()).isZero();
    }

    @Test
    void ownersKeepTheirPets() throws Exception {
        Owner owner = ownerRepository.save(owner("Tom", "Twopets", "Berlin"));
        petRepository.save(pet("Rex", owner));
        petRepository.save(pet("Ace", owner));
        startFromAnEmptyPersistenceContext();

        JsonNode response = list("/api/owners?lastName=Twopets");

        JsonNode pets = response.path("content").get(0).path("pets");
        assertThat(StreamSupport.stream(pets.spliterator(), false).map(pet -> pet.path("name").asText()))
                .containsExactly("Ace", "Rex");
    }

    @Test
    void aFullPageOfOwnersWithPetsAndVisitsCostsAtMostFourStatements() throws Exception {
        for (int i = 0; i < 20; i++) {
            Owner owner = owner("First" + i, "Last" + i, "Berlin");
            Pet pet = pet("Pet" + i, owner);
            pet.addVisit(visit());
            owner.addPet(pet);
            ownerRepository.save(owner);
        }
        startFromAnEmptyPersistenceContext();
        Statistics statistics = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            list("/api/owners?size=20");

            // the page, the count, the pets of those owners, the visits of those pets
            assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(4);
        } finally {
            statistics.setStatisticsEnabled(false);
        }
    }

    // The owners below are plain ASCII on purpose: what they pin is the sort chain and the tie-breaks,
    // which hold under any collation. Locale-aware order (diacritics, case) is covered by the migration.
    @Test
    void ordersByLastThenFirstNameByDefault() throws Exception {
        saveOwners("Bob Brown Cairo", "Zed Adams Athens", "Cy Clark Berlin", "Al Adams Dublin");

        assertThat(names(list("/api/owners"))).containsExactly("Adams Al", "Adams Zed", "Brown Bob", "Clark Cy");
    }

    @Test
    void ordersByNameDescending() throws Exception {
        saveOwners("Bob Brown Cairo", "Zed Adams Athens", "Cy Clark Berlin", "Al Adams Dublin");

        assertThat(names(list("/api/owners?sort=name,desc")))
                .containsExactly("Clark Cy", "Brown Bob", "Adams Zed", "Adams Al");
    }

    @Test
    void ordersByCityDescendingThenByNameInTheSameDirection() throws Exception {
        saveOwners("Al Adams Cairo", "Bob Brown Cairo", "Cy Clark Berlin", "Dan Dent Dublin");

        assertThat(names(list("/api/owners?sort=city,desc")))
                .containsExactly("Dent Dan", "Brown Bob", "Adams Al", "Clark Cy");
    }

    @Test
    void sameLastNameIsOrderedByFirstName() throws Exception {
        saveOwners("Wendy Darling London", "George Darling London");

        assertThat(names(list("/api/owners?sort=name"))).containsExactly("Darling George", "Darling Wendy");
    }

    @Test
    void identicalNamesKeepTheirIdOrderInEitherDirection() throws Exception {
        saveOwners("John Smith London", "John Smith London");

        assertThat(ids(list("/api/owners?sort=name,desc"))).isSorted();
    }

    @Test
    @DefaultFixture
    void walkingEveryPageOrderedByCityReturnsEachOwnerOnce() throws Exception {
        List<JsonNode> owners = new ArrayList<>();
        int totalPages = 1;
        for (int page = 0; page < totalPages; page++) {
            JsonNode response = list("/api/owners?sort=city&size=5&page=" + page);
            totalPages = response.path("page").path("totalPages").asInt();
            response.path("content").forEach(owners::add);
        }

        assertThat(owners).extracting(owner -> owner.path("id").asInt()).hasSize(26).doesNotHaveDuplicates();
        assertThat(owners).filteredOn(owner -> owner.path("city").asText().equals("London")).hasSize(4);
    }

    @ParameterizedTest
    @ValueSource(strings = {"telephone", "pets", "address,desc"})
    void onlyNameAndCityAreSortable(String sort) throws Exception {
        String key = sort.split(",")[0];
        mockMvc.perform(get("/api/owners?sort=" + sort))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail", containsString("'" + key + "'")));
    }

    @Test
    void anUnsupportedSortKeyCannotForgeALogLine() throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", "x\nINFO forged"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("'x?INFO forged'")));
    }

    private void saveOwners(String... firstLastCity) {
        for (String owner : firstLastCity) {
            String[] parts = owner.split(" ");
            ownerRepository.save(owner(parts[0], parts[1], parts[2]));
        }
        startFromAnEmptyPersistenceContext();
    }

    private void startFromAnEmptyPersistenceContext() {
        entityManager.flush();
        entityManager.clear();
    }

    private Owner owner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return owner;
    }

    private Pet pet(String name, Owner owner) {
        Pet pet = new Pet();
        pet.setName(name);
        pet.setBirthDate(LocalDate.of(2020, 1, 1));
        pet.setType(petTypeRepository.findById(1).orElseThrow());
        pet.setOwner(owner);
        return pet;
    }

    private static Visit visit() {
        Visit visit = new Visit();
        visit.setDate(LocalDate.of(2025, 1, 1));
        visit.setDescription("checkup");
        return visit;
    }

    private JsonNode list(String uri) throws Exception {
        String json = mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<String> names(JsonNode response) {
        return StreamSupport.stream(response.path("content").spliterator(), false)
                .map(owner -> owner.path("lastName").asText() + " " + owner.path("firstName").asText())
                .toList();
    }

    private static List<Integer> ids(JsonNode response) {
        return StreamSupport.stream(response.path("content").spliterator(), false)
                .map(owner -> owner.path("id").asInt())
                .toList();
    }

    private static List<String> lastNames(JsonNode response) {
        return StreamSupport.stream(response.path("content").spliterator(), false)
                .map(owner -> owner.path("lastName").asText())
                .toList();
    }
}
