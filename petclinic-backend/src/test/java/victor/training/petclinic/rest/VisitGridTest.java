package victor.training.petclinic.rest;

import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

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
    private static final LocalDate DAY_1 = LocalDate.parse("2026-01-01");
    private static final int VISIT_COUNT = 12;

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
    @Autowired
    JdbcTemplate jdbc;

    /** Visit i (1..12) is on day i, described "visit i" in two digits, of a pet whose name grows the other way. */
    @BeforeEach
    void twelveVisits() {
        PetType dog = petTypeRepository.save(TestData.aPetType("dog"));
        for (int i = 1; i <= VISIT_COUNT; i++) {
            Owner owner = TestData.anOwner();
            owner.setFirstName("Owner%02d".formatted(i));
            owner.setLastName("Last%02d".formatted(VISIT_COUNT - i));
            ownerRepository.save(owner);
            Pet pet = TestData.aPet();
            pet.setName("Pet%02d".formatted(VISIT_COUNT + 1 - i));
            pet.setType(dog);
            pet.setOwner(owner);
            petRepository.save(pet);
            Visit visit = new Visit();
            visit.setDate(DAY_1.plusDays(i - 1));
            visit.setDescription("visit %02d".formatted(i));
            pet.addVisit(visit);
            visitRepository.save(visit);
        }
    }

    private String getVisits(String query) throws Exception {
        return mockMvc.perform(get("/api/visits" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private static List<String> column(String json, String field) {
        return JsonPath.read(json, "$.content[*]." + field);
    }

    @Test
    void servesTheNewestTenFirst() throws Exception {
        String json = getVisits("");

        assertThat(column(json, "description")).containsExactly(
                "visit 12", "visit 11", "visit 10", "visit 09", "visit 08",
                "visit 07", "visit 06", "visit 05", "visit 04", "visit 03");
        assertThat((Integer) JsonPath.read(json, "$.page")).isZero();
        assertThat((Integer) JsonPath.read(json, "$.size")).isEqualTo(10);
        assertThat((Integer) JsonPath.read(json, "$.totalElements")).isEqualTo(VISIT_COUNT);
        assertThat((Integer) JsonPath.read(json, "$.totalPages")).isEqualTo(2);
        assertThat((String) JsonPath.read(json, "$.sort")).isEqualTo("date,desc");
    }

    @Test
    void servesEveryColumnOfTheRow() throws Exception {
        String json = getVisits("?size=5&sort=date,asc");

        assertThat((String) JsonPath.read(json, "$.content[0].date")).isEqualTo("2026-01-01");
        assertThat((String) JsonPath.read(json, "$.content[0].description")).isEqualTo("visit 01");
        assertThat((String) JsonPath.read(json, "$.content[0].petName")).isEqualTo("Pet12");
        assertThat((String) JsonPath.read(json, "$.content[0].ownerFirstName")).isEqualTo("Owner01");
        assertThat((String) JsonPath.read(json, "$.content[0].ownerLastName")).isEqualTo("Last11");
        assertThat((Integer) JsonPath.read(json, "$.content[0].id")).isNotNull();
        assertThat((Integer) JsonPath.read(json, "$.content[0].petId")).isNotNull();
        assertThat((Integer) JsonPath.read(json, "$.content[0].ownerId")).isNotNull();
    }

    @Test
    void servesTheSecondPage() throws Exception {
        String json = getVisits("?page=1&size=5");

        assertThat(column(json, "description")).containsExactly(
                "visit 07", "visit 06", "visit 05", "visit 04", "visit 03");
    }

    @ParameterizedTest
    @CsvSource({
            "date,asc,          date",
            "date,desc,         date",
            "description,asc,   description",
            "description,desc,  description",
            "pet,asc,           petName",
            "pet,desc,          petName",
            "owner,asc,         ownerFirstName",
            "owner,desc,        ownerFirstName",
    })
    void sortsByAnyColumn(String column, String direction, String field) throws Exception {
        List<String> values = column(getVisits("?sort=" + column + "," + direction), field);

        Comparator<String> order = direction.equals("asc") ? Comparator.naturalOrder() : Comparator.reverseOrder();
        assertThat(values).hasSize(10).isSortedAccordingTo(order);
    }

    @Test
    void anUnknownSortServesNewestFirst() throws Exception {
        String json = getVisits("?sort=telephone,asc");

        assertThat(column(json, "description")).first().isEqualTo("visit 12");
        assertThat((String) JsonPath.read(json, "$.sort")).isEqualTo("date,desc");
    }

    @Test
    void aSizeNotOfferedSnapsToTheNearestOne() throws Exception {
        String json = getVisits("?size=7");

        assertThat(column(json, "description")).hasSize(5);
        assertThat((Integer) JsonPath.read(json, "$.size")).isEqualTo(5);
    }

    @Test
    void aPagePastTheEndServesTheLastPage() throws Exception {
        String json = getVisits("?page=40&size=5");

        assertThat((Integer) JsonPath.read(json, "$.page")).isEqualTo(2);
        assertThat(column(json, "description")).containsExactly("visit 02", "visit 01");
    }

    @Test
    void garbageParamsNeverFail() throws Exception {
        String json = getVisits("?page=x&size=y&sort=z");

        assertThat(column(json, "description")).hasSize(10).first().isEqualTo("visit 12");
    }

    @Test
    void anEmptyClinicServesAnEmptyFirstPage() throws Exception {
        jdbc.update("DELETE FROM visits");

        String json = getVisits("?page=3");

        assertThat(column(json, "description")).isEmpty();
        assertThat((Integer) JsonPath.read(json, "$.page")).isZero();
        assertThat((Integer) JsonPath.read(json, "$.totalPages")).isZero();
    }

    @Test
    void logsTheOwnersServed(CapturedOutput output) throws Exception {
        getVisits("?page=2&size=5&sort=date,asc");

        assertThat(output).contains("Visits page 2 served: [Owner11 Last01, Owner12 Last00]");
    }
}
