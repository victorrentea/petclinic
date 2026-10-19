package victor.training.petclinic.rest;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetTypeRepository;

import java.util.HashSet;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Issue #25: owners come one page at a time, sorted by name or city. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {
    // the seed owners share the table, so every owner made here carries this last-name prefix
    private static final String PREFIX = "Pgx";

    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetTypeRepository petTypeRepository;
    @Autowired
    EntityManager entityManager;

    @Test
    void theFirstPageHoldsTenOwnersByDefault() throws Exception {
        DocumentContext page = list("");

        assertThat(page.<List<?>>read("$.content")).hasSize(10);
        assertThat(page.<Integer>read("$.totalElements")).isEqualTo((int) ownerRepository.count());
    }

    @Test
    void aChosenPageSizeSkipsTheEarlierPages() throws Exception {
        ownersNamed("Ann", "Bob", "Cid", "Dan", "Eve", "Fay", "Gus");

        DocumentContext page = list("lastName=" + PREFIX + "&size=5&page=1");

        assertThat(firstNames(page)).containsExactly("Fay", "Gus");
        assertThat(page.<Integer>read("$.totalElements")).isEqualTo(7);
    }

    @Test
    void aPagePastTheEndIsEmptyButKeepsTheTotal() throws Exception {
        ownersNamed("Ann", "Bob");

        DocumentContext page = list("lastName=" + PREFIX + "&size=5&page=3");

        assertThat(firstNames(page)).isEmpty();
        assertThat(page.<Integer>read("$.totalElements")).isEqualTo(2);
    }

    @Test
    void theFilterCountsOnlyTheMatchingOwners() throws Exception {
        ownersNamed("Ann", "Bob", "Cid");

        DocumentContext page = list("lastName=" + PREFIX);

        assertThat(page.<List<String>>read("$.content[*].lastName")).allMatch(name -> name.startsWith(PREFIX));
        assertThat(page.<Integer>read("$.totalElements")).isEqualTo(3);
    }

    @Test
    void ownersSortByLastNameThenFirstNameByDefault() throws Exception {
        owner("Bob", PREFIX + "b", "Oslo");
        owner("Ann", PREFIX + "z", "Oslo");
        owner("Cid", PREFIX + "a", "Oslo");
        owner("Ann", PREFIX + "a", "Oslo");

        assertThat(fullNames(list("lastName=" + PREFIX)))
                .containsExactly("Ann Pgxa", "Cid Pgxa", "Bob Pgxb", "Ann Pgxz");
    }

    @Test
    void aDescendingNameSortReversesTheWholeName() throws Exception {
        owner("Bob", PREFIX + "b", "Oslo");
        owner("Ann", PREFIX + "z", "Oslo");
        owner("Cid", PREFIX + "a", "Oslo");
        owner("Ann", PREFIX + "a", "Oslo");

        assertThat(fullNames(list("lastName=" + PREFIX + "&sort=name,desc")))
                .containsExactly("Ann Pgxz", "Bob Pgxb", "Cid Pgxa", "Ann Pgxa");
    }

    @Test
    void aDescendingCitySortKeepsNamesAscendingWithinACity() throws Exception {
        owner("Cid", PREFIX, "Athens");
        owner("Bob", PREFIX, "Zurich");
        owner("Ann", PREFIX, "Zurich");

        DocumentContext page = list("lastName=" + PREFIX + "&sort=city,desc");

        assertThat(firstNames(page)).containsExactly("Ann", "Bob", "Cid");
    }

    @Test
    void anAscendingCitySortOrdersCitiesThenNames() throws Exception {
        owner("Ann", PREFIX + "b", "Zurich");
        owner("Cid", PREFIX, "Athens");
        owner("Bob", PREFIX + "a", "Zurich");

        DocumentContext page = list("lastName=" + PREFIX + "&sort=city");

        assertThat(firstNames(page)).containsExactly("Cid", "Bob", "Ann");
    }

    @Test
    void identicalNamesNeitherRepeatNorVanishAcrossPages() throws Exception {
        List<Integer> ids = IntStream.range(0, 7).mapToObj(i -> owner("Same", PREFIX, "Oslo").getId()).toList();

        List<Integer> firstPage = list("lastName=" + PREFIX + "&size=5&page=0").read("$.content[*].id");
        List<Integer> secondPage = list("lastName=" + PREFIX + "&size=5&page=1").read("$.content[*].id");

        HashSet<Integer> seen = new HashSet<>(firstPage);
        seen.addAll(secondPage);
        assertThat(firstPage.size() + secondPage.size()).isEqualTo(7);
        assertThat(seen).containsExactlyInAnyOrderElementsOf(ids);
    }

    @Test
    void accentedNamesSortWhereReadersExpectThem() throws Exception {
        owner("Ann", PREFIX + "tremaine", "Oslo");
        owner("Ann", PREFIX + "śliwiński", "Oslo");
        owner("Ann", PREFIX + "silver", "Oslo");

        assertThat(values(list("lastName=" + PREFIX), "lastName"))
                .containsExactly("Pgxsilver", "Pgxśliwiński", "Pgxtremaine");
    }

    @Test
    void aPageCostsTheSameNumberOfQueriesWhateverItsSize() throws Exception {
        PetType donkey = petTypeRepository.save(TestData.aPetType("donkey"));
        for (int i = 0; i < 20; i++) {
            ownerWithAPetAndAVisit(donkey);
        }

        long forFive = statementsToList("lastName=" + PREFIX + "&size=5");
        long forTwenty = statementsToList("lastName=" + PREFIX + "&size=20");

        assertThat(forTwenty).isEqualTo(forFive);
    }

    private void ownerWithAPetAndAVisit(PetType type) {
        Owner owner = owner("Ann", PREFIX, "Oslo");
        Pet pet = TestData.aPet();
        pet.setType(type);
        owner.addPet(pet);
        Visit visit = new Visit();
        visit.setDescription("checkup");
        pet.addVisit(visit);
        ownerRepository.save(owner);
    }

    private long statementsToList(String query) throws Exception {
        entityManager.flush();
        entityManager.clear();
        Statistics statistics = entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        list(query);
        return statistics.getPrepareStatementCount();
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "size=50        | Size",
            "page=-1        | Page",
            "sort=telephone | Sort",
            "sort=name,up   | Sort",
            "page=abc       | Page",
            "size=abc       | Size",
    })
    void anUnofferedListingIsRefusedNamingTheParameter(String query, String parameter) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasItem(startsWith(parameter))));
    }

    private void ownersNamed(String... firstNames) {
        for (String firstName : firstNames) {
            owner(firstName, PREFIX, "Oslo");
        }
    }

    private Owner owner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner);
    }

    private DocumentContext list(String query) throws Exception {
        String json = mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.parse(json);
    }

    private static List<String> firstNames(DocumentContext page) {
        return values(page, "firstName");
    }

    private static List<String> values(DocumentContext page, String field) {
        return page.read("$.content[*]." + field);
    }

    private static List<String> fullNames(DocumentContext page) {
        List<String> first = page.read("$.content[*].firstName");
        List<String> last = page.read("$.content[*].lastName");
        return IntStream.range(0, first.size()).mapToObj(i -> first.get(i) + " " + last.get(i)).toList();
    }
}
