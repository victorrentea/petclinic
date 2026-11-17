package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.function.Function;
import java.util.stream.IntStream;

import org.hibernate.SessionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
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
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

/** Global ordering, literal prefix search and bounded retrieval of {@code GET /api/owners}. */
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerPagingTest {
    /** The Romanian alphabet positions the spec names, deliberately written out of order. */
    private static final List<String> ROMANIAN_ORDER = List.of("a", "ă", "â", "b", "i", "î", "j", "s", "ș", "t", "ț",
            "z");

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
    VisitRepository visitRepository;
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    EntityManager entityManager;

    @BeforeEach
    void startFromAnEmptyRegister() {
        assertThat(ownerRepository.count()).isZero();
    }

    private Owner saveOwner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner);
    }

    private Owner saveOwnerWithLastName(String lastName) {
        return saveOwner("First", lastName, "City");
    }

    /** Walks every page of a request in order and collects the chosen owner field. */
    private List<String> walk(String query, int size, Function<JsonNode, String> field) throws Exception {
        List<String> all = new ArrayList<>();
        for (int page = 0;; page++) {
            JsonNode content = getPage(query + "&page=" + page + "&size=" + size).get("content");
            if (content.isEmpty()) {
                return all;
            }
            content.forEach(owner -> all.add(field.apply(owner)));
        }
    }

    private JsonNode getPage(String query) throws Exception {
        entityManager.flush();
        entityManager.clear();
        String json = mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static Function<JsonNode, String> text(String field) {
        return owner -> owner.get(field).asText();
    }

    @Test
    void romanianCollationIsInstalled() {
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM pg_collation WHERE collname = 'ro-RO-x-icu'", Integer.class)).isEqualTo(1);
    }

    @Test
    void nameSorting_ordersLastThenFirstNameIgnoringCaseThenId_acrossPages() throws Exception {
        saveOwner("Zoe", "davis", "c");
        saveOwner("Ana", "Davis", "c");
        saveOwner("ana", "DAVIS", "c");
        saveOwner("Ion", "Brown", "c");
        saveOwner("Dan", "Evans", "c");

        List<String> ascending = walk("sort=lastName,asc", 5, text("id"));
        List<String> descending = walk("sort=lastName,desc", 5, text("id"));

        // ids 1..5 in insertion order: Zoe davis, Ana Davis, ana DAVIS, Ion Brown, Dan Evans
        int zoe = firstId(), ana = zoe + 1, anaUpper = zoe + 2, brown = zoe + 3, evans = zoe + 4;
        assertThat(ascending).containsExactly(ids(brown, ana, anaUpper, zoe, evans));
        assertThat(descending).containsExactly(ids(evans, zoe, ana, anaUpper, brown));
    }

    private int firstId() {
        return jdbc.queryForObject("SELECT min(id) FROM owners", Integer.class);
    }

    private static String[] ids(int... ids) {
        return IntStream.of(ids).mapToObj(String::valueOf).toArray(String[]::new);
    }

    @Test
    void sortingIsGlobalNotPerPage() throws Exception {
        List<String> names = IntStream.range(0, 12).mapToObj(i -> "Name%02d".formatted((i * 5) % 12)).toList();
        names.forEach(this::saveOwnerWithLastName);

        assertThat(walk("sort=lastName,asc", 5, text("lastName")))
                .containsExactlyElementsOf(names.stream().sorted().toList());
        assertThat(walk("sort=lastName,desc", 5, text("lastName")))
                .containsExactlyElementsOf(names.stream().sorted().toList().reversed());
    }

    @Test
    void citySorting_ignoresCaseAndBreaksTiesById() throws Exception {
        Owner first = saveOwner("A", "A", "Bravo");
        Owner second = saveOwner("B", "B", "bravo");
        Owner third = saveOwner("C", "C", "alpha");

        assertThat(walk("sort=city,asc", 5, text("id")))
                .containsExactly(ids(third.getId(), first.getId(), second.getId()));
        assertThat(walk("sort=city,desc", 5, text("id")))
                .containsExactly(ids(first.getId(), second.getId(), third.getId()));
    }

    @Test
    void nullValuesSortLast_inBothDirections() throws Exception {
        saveOwner("A", "A", "x");
        Owner withoutCity = saveOwner("B", "B", "x");
        saveOwner("C", "C", "y");
        entityManager.flush();
        jdbc.update("UPDATE owners SET city = NULL WHERE id = ?", withoutCity.getId());

        assertThat(walk("sort=city,asc", 5, text("id")).getLast())
                .isEqualTo(String.valueOf(withoutCity.getId()));
        assertThat(walk("sort=city,desc", 5, text("id")).getLast())
                .isEqualTo(String.valueOf(withoutCity.getId()));
    }

    @Test
    void romanianLettersKeepTheirAlphabetPositionsInNameAndCity() throws Exception {
        List<String> shuffled = new ArrayList<>(ROMANIAN_ORDER);
        Collections.shuffle(shuffled, new Random(7));
        for (String letter : shuffled) {
            // upper-case surname and city, to prove the comparison ignores case
            String upper = letter.toUpperCase(Locale.forLanguageTag("ro"));
            saveOwner(letter + "ion", upper + "x", upper + "town");
        }
        List<String> expectedAsc = ROMANIAN_ORDER.stream().map(l -> l.toUpperCase(Locale.ROOT)).toList();

        for (String sort : List.of("lastName", "city")) {
            assertThat(walk("sort=" + sort + ",asc", 5, o -> firstLetter(o, sort)))
                    .as(sort + " ascending").containsExactlyElementsOf(expectedAsc);
            assertThat(walk("sort=" + sort + ",desc", 5, o -> firstLetter(o, sort)))
                    .as(sort + " descending").containsExactlyElementsOf(expectedAsc.reversed());
        }
    }

    private static String firstLetter(JsonNode owner, String field) {
        return owner.get(field).asText().substring(0, 1);
    }

    @Test
    void firstNameIsTheRomanianSecondaryKeyOfTheNameSort() throws Exception {
        for (String letter : List.of("t", "ț", "a", "z", "ă", "s", "ș")) {
            saveOwner(letter, "Same", "c");
        }

        assertThat(walk("sort=lastName,asc", 5, text("firstName")))
                .containsExactly("a", "ă", "s", "ș", "t", "ț", "z");
        assertThat(walk("sort=lastName,desc", 5, text("firstName")))
                .containsExactly("z", "ț", "t", "ș", "s", "ă", "a");
    }

    @Test
    void prefixSearch_isCaseSensitiveAndTreatsWildcardsAsText() throws Exception {
        Owner percent = saveOwnerWithLastName("100%Real");
        saveOwnerWithLastName("1000Real");
        Owner underscore = saveOwnerWithLastName("a_b");
        saveOwnerWithLastName("axb");
        Owner backslash = saveOwnerWithLastName("c\\d");
        saveOwnerWithLastName("cd");
        saveOwnerWithLastName("Davis");

        assertThat(walk("lastName=100%", 5, text("id"))).containsExactly(String.valueOf(percent.getId()));
        assertThat(walk("lastName=a_", 5, text("id"))).containsExactly(String.valueOf(underscore.getId()));
        assertThat(walk("lastName=c\\", 5, text("id"))).containsExactly(String.valueOf(backslash.getId()));
        assertThat(walk("lastName=dav", 5, text("id"))).isEmpty();
        assertThat(getPage("lastName=Dav").get("totalElements").asLong()).isEqualTo(1);
    }

    @Test
    void sortingAndPagingSurviveSqlInjectionAttempts() throws Exception {
        saveOwnerWithLastName("O'Brien");

        assertThat(getPage("lastName='; DROP TABLE owners;--").get("totalElements").asLong()).isZero();
        assertThat(getPage("lastName=O'B").get("totalElements").asLong()).isEqualTo(1);
    }

    @Test
    void everyListItemCarriesItsCompletePetAndVisitData() throws Exception {
        PetType dog = petTypeRepository.save(TestData.aPetType("dog"));
        Owner owner = saveOwnerWithLastName("Smith");
        Pet pet = savePet(owner, dog, "Rex");
        saveVisit(pet, "checkup");
        saveVisit(pet, "vaccine");

        JsonNode item = getPage("").get("content").get(0);

        JsonNode petJson = item.get("pets").get(0);
        assertThat(petJson.get("name").asText()).isEqualTo("Rex");
        assertThat(petJson.get("type").get("name").asText()).isEqualTo("dog");
        assertThat(petJson.get("ownerId").asInt()).isEqualTo(owner.getId());
        assertThat(petJson.get("visits")).hasSize(2);
    }

    @Test
    void relatedDataIsBoundedToThreeSelects_whateverThePetsAndVisits() throws Exception {
        PetType dog = petTypeRepository.save(TestData.aPetType("dog"));
        Owner owner = saveOwnerWithLastName("Smith");
        saveOwnerWithLastName("Jones");
        savePet(owner, dog, "Rex");
        assertThat(selectsFor("")).isLessThanOrEqualTo(3);

        for (int p = 0; p < 4; p++) {
            Pet pet = savePet(owner, dog, "Pet" + p);
            for (int v = 0; v < 5; v++) {
                saveVisit(pet, "visit " + v);
            }
        }

        assertThat(selectsFor("")).isLessThanOrEqualTo(3);
        assertThat(selectsFor("page=7")).as("empty page: ids + count").isLessThanOrEqualTo(2);
    }

    private Pet savePet(Owner owner, PetType type, String name) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setBirthDate(LocalDate.of(2020, 1, 1));
        pet.setType(type);
        pet.setOwner(owner);
        return petRepository.save(pet);
    }

    private void saveVisit(Pet pet, String description) {
        Visit visit = new Visit();
        visit.setPet(pet);
        visit.setDescription(description);
        visitRepository.save(visit);
    }

    /** SELECTs issued by one request, with a cold persistence context so nothing is served from memory. */
    private long selectsFor(String query) throws Exception {
        entityManager.flush();
        entityManager.clear();
        var statistics = entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        mockMvc.perform(get("/api/owners?" + query)).andExpect(status().isOk());
        return statistics.getPrepareStatementCount();
    }
}
