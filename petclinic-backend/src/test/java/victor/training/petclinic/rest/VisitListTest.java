package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitPageDto;

// Every test starts from no visits at all (rolled back afterwards), so the seed's visits
// never shift the expected page contents.
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class VisitListTest {

    static final LocalDate DAY = LocalDate.parse("2026-01-01");

    @Autowired
    MockMvc mockMvc;
    @Autowired
    VisitRepository visitRepository;
    @Autowired
    PetRepository petRepository;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetTypeRepository petTypeRepository;
    @Autowired
    EntityManager entityManager;

    ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @BeforeEach
    void noVisits() {
        entityManager.createQuery("DELETE FROM Visit").executeUpdate();
    }

    @Test
    void defaultPage_isTheTenLatestVisits() throws Exception {
        Pet leo = pet("Leo", owner("George", "Franklin"));
        IntStream.range(0, 12).forEach(day -> visit(DAY.plusDays(day), "checkup " + day, leo));

        VisitPageDto page = list("");

        assertThat(page.number()).isZero();
        assertThat(page.size()).isEqualTo(10);
        assertThat(page.totalElements()).isEqualTo(12);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(page.content()).extracting(VisitDto::getDescription).containsExactly(
                "checkup 11", "checkup 10", "checkup 9", "checkup 8", "checkup 7",
                "checkup 6", "checkup 5", "checkup 4", "checkup 3", "checkup 2");
    }

    @Test
    void aVisitCarriesItsPetAndOwner() throws Exception {
        Owner george = owner("George", "Franklin");
        Pet leo = pet("Leo", george);
        visit(DAY, "rabies shot", leo);

        VisitDto visit = list("").content().get(0);

        assertThat(visit.getDate()).isEqualTo(DAY);
        assertThat(visit.getPetId()).isEqualTo(leo.getId());
        assertThat(visit.getPetName()).isEqualTo("Leo");
        assertThat(visit.getOwnerId()).isEqualTo(george.getId());
        assertThat(visit.getOwnerFirstName()).isEqualTo("George");
        assertThat(visit.getOwnerLastName()).isEqualTo("Franklin");
    }

    @Test
    void lastPartialPage() throws Exception {
        Pet leo = pet("Leo", owner("George", "Franklin"));
        IntStream.range(0, 7).forEach(day -> visit(DAY.plusDays(day), "checkup", leo));

        VisitPageDto page = list("?page=1&size=5");

        assertThat(page.content()).hasSize(2);
        assertThat(page.number()).isEqualTo(1);
        assertThat(page.totalPages()).isEqualTo(2);
    }

    @Test
    void pagePastTheEnd_isEmptyWithTotals() throws Exception {
        Pet leo = pet("Leo", owner("George", "Franklin"));
        IntStream.range(0, 7).forEach(day -> visit(DAY.plusDays(day), "checkup", leo));

        VisitPageDto page = list("?page=50&size=5");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isEqualTo(7);
        assertThat(page.totalPages()).isEqualTo(2);
    }

    @Test
    void sortByDateAscending() throws Exception {
        Pet leo = pet("Leo", owner("George", "Franklin"));
        visit(DAY.plusDays(2), "third", leo);
        visit(DAY, "first", leo);
        visit(DAY.plusDays(1), "second", leo);

        assertThat(descriptions("?sort=date,asc")).containsExactly("first", "second", "third");
    }

    @Test
    void sortByDescription() throws Exception {
        Pet leo = pet("Leo", owner("George", "Franklin"));
        visit(DAY, "spayed", leo);
        visit(DAY, "checkup", leo);
        visit(DAY, "rabies shot", leo);

        assertThat(descriptions("?sort=description,asc")).containsExactly("checkup", "rabies shot", "spayed");
        assertThat(descriptions("?sort=description,desc")).containsExactly("spayed", "rabies shot", "checkup");
    }

    @Test
    void sortByPet_thenLatestFirst() throws Exception {
        Owner george = owner("George", "Franklin");
        Pet rosy = pet("Rosy", george);
        Pet basil = pet("Basil", george);
        visit(DAY, "rosy", rosy);
        visit(DAY, "basil old", basil);
        visit(DAY.plusDays(1), "basil new", basil);

        assertThat(descriptions("?sort=pet,asc")).containsExactly("basil new", "basil old", "rosy");
    }

    @Test
    void sortByOwnerName_firstNameThenLastName() throws Exception {
        visit(DAY, "jean coleman", pet("Max", owner("Jean", "Coleman")));
        visit(DAY, "betty davis", pet("Basil", owner("Betty", "Davis")));
        visit(DAY, "betty adams", pet("Rosy", owner("Betty", "Adams")));

        assertThat(descriptions("?sort=owner,desc")).containsExactly("jean coleman", "betty davis", "betty adams");
    }

    @Test
    void sortWithoutDirection_isAscending() throws Exception {
        Pet leo = pet("Leo", owner("George", "Franklin"));
        visit(DAY, "b", leo);
        visit(DAY, "a", leo);

        assertThat(descriptions("?sort=description")).containsExactly("a", "b");
    }

    @Test
    void identicalVisits_onAPageBoundary_appearExactlyOnce() throws Exception {
        Pet leo = pet("Leo", owner("George", "Franklin"));
        List<Integer> ids = IntStream.range(0, 7).mapToObj(i -> visit(DAY, "checkup", leo).getId()).toList();

        List<Integer> seen = new ArrayList<>();
        seen.addAll(idsOn(list("?size=5&page=0&sort=description")));
        seen.addAll(idsOn(list("?size=5&page=1&sort=description")));

        assertThat(seen).containsExactlyElementsOf(ids);
    }

    @Test
    void sizeAtTheCap_isAccepted() throws Exception {
        assertThat(list("?size=100").size()).isEqualTo(100);
    }

    @Test
    void sizeAboveTheCap_isRejected() throws Exception {
        mockMvc.perform(get("/api/visits?size=101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(containsString("size")));
    }

    @Test
    void sizeZero_isRejected() throws Exception {
        mockMvc.perform(get("/api/visits?size=0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(containsString("size")));
    }

    @Test
    void negativePage_isRejected() throws Exception {
        mockMvc.perform(get("/api/visits?page=-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(containsString("page")));
    }

    @Test
    void unsupportedSortKey_isRejected() throws Exception {
        mockMvc.perform(get("/api/visits?sort=id,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(allOf(containsString("date"), containsString("owner"))));
    }

    @Test
    void aPageLoadsPetsAndOwnersInTheSameQuery_notOneQueryPerVisit() throws Exception {
        IntStream.range(0, 20).forEach(i -> visit(DAY, "checkup", pet("Pet" + i, owner("Owner" + i, "Page"))));
        entityManager.flush();
        entityManager.clear();
        Statistics statistics = entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();

        list("?size=20");

        // page + count + the one pet type all those pets share
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
    }

    private Owner owner(String firstName, String lastName) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        return ownerRepository.save(owner);
    }

    private Pet pet(String name, Owner owner) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setOwner(owner);
        pet.setType(petTypeRepository.findAll().get(0));
        return petRepository.save(pet);
    }

    private Visit visit(LocalDate date, String description, Pet pet) {
        Visit visit = new Visit();
        visit.setDate(date);
        visit.setDescription(description);
        pet.addVisit(visit);
        return visitRepository.save(visit);
    }

    private VisitPageDto list(String query) throws Exception {
        String json = mockMvc.perform(get("/api/visits" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readValue(json, VisitPageDto.class);
    }

    private List<String> descriptions(String query) throws Exception {
        return list(query).content().stream().map(VisitDto::getDescription).toList();
    }

    private static List<Integer> idsOn(VisitPageDto page) {
        return page.content().stream().map(VisitDto::getId).toList();
    }
}
