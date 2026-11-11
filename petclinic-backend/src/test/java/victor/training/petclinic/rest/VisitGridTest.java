package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
@ExtendWith(OutputCaptureExtension.class)
class VisitGridTest {
    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetRepository petRepository;
    @Autowired
    PetTypeRepository petTypeRepository;
    @Autowired
    VisitRepository visitRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private PetType dog;

    @BeforeEach
    void threeVisits() {
        dog = petTypeRepository.save(TestData.aPetType("dog"));
        Pet rex = aPet("Rex", anOwner("Zoe", "Adams"));
        Pet bella = aPet("Bella", anOwner("Alice", "Young"));
        aVisit(rex, "2024-01-10", "checkup");
        aVisit(bella, "2025-05-20", "x-ray");
        aVisit(rex, "2023-03-15", "annual shot");
    }

    @Test
    void newestFirst_tenPerPage_byDefault() throws Exception {
        JsonNode page = getPage("");

        assertThat(column(page, "date")).containsExactly("2025-05-20", "2024-01-10", "2023-03-15");
        assertThat(page.at("/page/size").asInt()).isEqualTo(10);
        assertThat(page.at("/page/totalElements").asInt()).isEqualTo(3);
    }

    @Test
    void rowCarriesPetAndOwner() throws Exception {
        JsonNode row = getPage("").at("/content/0");

        assertThat(row.path("description").asText()).isEqualTo("x-ray");
        assertThat(row.path("petName").asText()).isEqualTo("Bella");
        assertThat(row.path("ownerFirstName").asText()).isEqualTo("Alice");
        assertThat(row.path("ownerLastName").asText()).isEqualTo("Young");
        assertThat(row.path("ownerId").isInt()).isTrue();
        assertThat(row.path("id").isInt()).isTrue();
    }

    @Test
    void secondPageOfTwo() throws Exception {
        for (int i = 1; i <= 7; i++) {
            aVisit(petRepository.findAll().get(0), "2020-01-0" + i, "old " + i);
        }

        JsonNode page = getPage("?page=1&size=5");

        assertThat(page.at("/content").size()).isEqualTo(5);
        assertThat(page.at("/page/number").asInt()).isEqualTo(1);
        assertThat(page.at("/page/totalPages").asInt()).isEqualTo(2);
        assertThat(column(page, "date")).first().isEqualTo("2020-01-05");
    }

    @ParameterizedTest
    @CsvSource({
            "date,        asc,  2023-03-15, 2024-01-10, 2025-05-20",
            "date,        desc, 2025-05-20, 2024-01-10, 2023-03-15",
            "description, asc,  annual shot, checkup, x-ray",
            "description, desc, x-ray, checkup, annual shot",
    })
    void sortsByVisitColumn(String sort, String direction, String first, String second, String third)
            throws Exception {
        JsonNode page = getPage("?sort=" + sort + "&direction=" + direction);

        assertThat(column(page, sort)).containsExactly(first, second, third);
    }

    @Test
    void sortsByPet() throws Exception {
        assertThat(column(getPage("?sort=pet&direction=asc"), "petName")).containsExactly("Bella", "Rex", "Rex");
        assertThat(column(getPage("?sort=pet&direction=desc"), "petName")).containsExactly("Rex", "Rex", "Bella");
    }

    @Test
    void sortsByOwnerAsDisplayed_firstNameThenLastName() throws Exception {
        assertThat(column(getPage("?sort=owner&direction=asc"), "ownerFirstName"))
                .containsExactly("Alice", "Zoe", "Zoe");
        assertThat(column(getPage("?sort=owner&direction=desc"), "ownerFirstName"))
                .containsExactly("Zoe", "Zoe", "Alice");
    }

    @ParameterizedTest
    @CsvSource({
            "?sort=id&direction=asc",
            "?sort=pet.owner.telephone&direction=asc",
            "?sort=date&direction=sideways",
            "?size=7",
            "?size=1000",
            "?page=-1",
    })
    void rejectsAnythingNotWhitelisted(String query) throws Exception {
        mockMvc.perform(get("/api/visits" + query))
                .andExpect(status().isBadRequest());
    }

    @Test
    void logsTheOwnersServed(CapturedOutput output) throws Exception {
        getPage("?sort=owner&direction=asc");

        assertThat(output).contains("Visits page 0 served: [Alice Young, Zoe Adams, Zoe Adams]");
    }

    private JsonNode getPage(String query) throws Exception {
        String json = mockMvc.perform(get("/api/visits" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<String> column(JsonNode page, String field) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(row -> row.path(field).asText())
                .toList();
    }

    private Owner anOwner(String firstName, String lastName) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        return ownerRepository.save(owner);
    }

    private Pet aPet(String name, Owner owner) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setOwner(owner);
        pet.setType(dog);
        return petRepository.save(pet);
    }

    private void aVisit(Pet pet, String date, String description) {
        Visit visit = new Visit();
        visit.setDate(LocalDate.parse(date));
        visit.setDescription(description);
        pet.addVisit(visit);
        visitRepository.save(visit);
    }
}
