package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;

/**
 * The paged contract of GET /api/owners. Fixtures use last names starting with "Qz", which
 * no seeded owner has, so filtering on that prefix isolates them from db/seed/R__seed.sql.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {

    private static final Comparator<Owner> BY_NAME = Comparator.comparing(Owner::getLastName)
            .thenComparing(Owner::getFirstName)
            .thenComparing(Owner::getId);
    private static final Comparator<Owner> BY_CITY = Comparator.comparing(Owner::getCity).thenComparing(BY_NAME);

    @Autowired
    MockMvc mockMvc;
    @Autowired
    EntityManager entityManager;
    @Autowired
    JdbcTemplate jdbc;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void defaultRequest_returnsFirstTenByNameAscendingAndTheTotal() throws Exception {
        JsonNode page = list("/api/owners");

        List<Integer> expectedIds = jdbc.queryForList(
                "SELECT id FROM owners ORDER BY last_name, first_name, id LIMIT 10", Integer.class);
        assertThat(ids(page)).containsExactlyElementsOf(expectedIds);
        assertThat(page.get("totalElements").asLong()).isEqualTo(26);
    }

    @Test
    void response_isAnObjectWithExactlyContentAndTotalElements() throws Exception {
        JsonNode page = list("/api/owners");

        assertThat(page.isObject()).isTrue();
        List<String> fields = new ArrayList<>();
        page.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("content", "totalElements");
        assertThat(page.get("content").isArray()).isTrue();
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedSizes_returnThatManyRows(int size) throws Exception {
        assertThat(list("/api/owners?size=" + size).get("content")).hasSize(size);
    }

    @Test
    void requestedPage_returnsTheMatchingSliceOfTheOrdering() throws Exception {
        List<Integer> expectedIds = jdbc.queryForList(
                "SELECT id FROM owners ORDER BY last_name, first_name, id OFFSET 5 LIMIT 5", Integer.class);

        JsonNode page = list("/api/owners?page=1&size=5");

        assertThat(ids(page)).containsExactlyElementsOf(expectedIds);
        assertThat(page.get("totalElements").asLong()).isEqualTo(26);
    }

    @Test
    void pageBeyondTheLast_isEmptyButKeepsTheRealTotal() throws Exception {
        JsonNode page = list("/api/owners?page=100");

        assertThat(page.get("content")).isEmpty();
        assertThat(page.get("totalElements").asLong()).isEqualTo(26);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "size=7", "size=0", "size=-5", "size=abc",
            "page=-1", "page=abc", "page=1.5", "page=99999999999", "page=2147483647",
            "sort=lastName,asc", "sort=telephone,asc", "sort=name", "sort=name,up", "sort=name,ASC",
            "sort=,asc", "sort=name,asc,city,desc", "sort=name,asc&sort=city,desc"})
    void invalidPagingOrSorting_isRejectedWith400(String query) throws Exception {
        String parameter = query.substring(0, query.indexOf('='));
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.errors[0]", startsWith(parameter + " ")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"sort=<b>bold</b>,asc", "page=<b>bold</b>", "size=<b>bold</b>"})
    void rejection_doesNotEchoTheInput(String query) throws Exception {
        String body = mockMvc.perform(get("/api/owners").queryParam(
                query.substring(0, query.indexOf('=')), query.substring(query.indexOf('=') + 1)))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("bold");
    }

    @Test
    void prefixFilter_isCaseSensitiveAndAnchoredAtTheStart() throws Exception {
        assertThat(names(list("/api/owners?lastName=Pot")))
                .containsExactly("Beatrix Potter", "Harry Potter");
        assertThat(list("/api/owners?lastName=otter").get("totalElements").asLong()).isZero();
        assertThat(list("/api/owners?lastName=Harry").get("totalElements").asLong()).isZero();
        assertThat(list("/api/owners?lastName=potter").get("totalElements").asLong()).isZero();
    }

    @Test
    void emptyLastName_matchesEveryOwner() throws Exception {
        assertThat(list("/api/owners?lastName=").get("totalElements").asLong()).isEqualTo(26);
    }

    @Test
    void filteredPage_countsTheWholeFilteredSet() throws Exception {
        IntStream.range(0, 7).forEach(i -> persist(owner("First" + i, "Qzfilter", "Rome")));

        JsonNode page = list("/api/owners?lastName=Qz&size=5&page=1");

        assertThat(page.get("content")).hasSize(2);
        assertThat(page.get("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void wildcardCharactersInThePrefix_matchLiterally() throws Exception {
        persist(owner("Percent", "Qz%a", "Rome"));
        persist(owner("Underscore", "Qz_b", "Rome"));
        persist(owner("Plain", "Qzxc", "Rome"));

        assertThat(names(listByLastName("Qz%"))).containsExactly("Percent Qz%a");
        assertThat(names(listByLastName("Qz_"))).containsExactly("Underscore Qz_b");
    }

    @Test
    void nameSort_breaksFullNameTiesOnIdInTheRequestedDirection() throws Exception {
        List<Owner> owners = List.of(
                persist(owner("Same", "Qztie", "Rome")),
                persist(owner("Same", "Qztie", "Oslo")),
                persist(owner("Same", "Qztie", "Kyiv")),
                persist(owner("Anna", "Qztie", "Rome")),
                persist(owner("Zoe", "Qzalpha", "Rome")),
                persist(owner("Bob", "Qzzz", "Rome")),
                persist(owner("Same", "Qztie", "Riga")));

        assertThat(traverse("name,asc", owners.size()))
                .containsExactlyElementsOf(idsSortedBy(owners, BY_NAME));
        assertThat(traverse("name,desc", owners.size()))
                .containsExactlyElementsOf(idsSortedBy(owners, BY_NAME.reversed()));
    }

    @Test
    void citySort_ordersByCityThenNameThenIdInTheRequestedDirection() throws Exception {
        List<Owner> owners = List.of(
                persist(owner("Ann", "Qzcity", "London")),
                persist(owner("Ann", "Qzcity", "London")),
                persist(owner("Bea", "Qzcity", "London")),
                persist(owner("Ann", "Qzabc", "London")),
                persist(owner("Carl", "Qzcity", "Bristol")),
                persist(owner("Dan", "Qzcity", "York")),
                persist(owner("Eve", "Qzcity", "Bristol")));

        assertThat(traverse("city,desc", owners.size()))
                .containsExactlyElementsOf(idsSortedBy(owners, BY_CITY.reversed()));
        assertThat(traverse("city,asc", owners.size()))
                .containsExactlyElementsOf(idsSortedBy(owners, BY_CITY));
    }

    @Test
    void listedOwner_carriesTheSameNestedDataAsTheDetailEndpoint() throws Exception {
        PetType cat = entityManager.find(PetType.class, 1);
        PetType dog = entityManager.find(PetType.class, 2);
        Owner withPets = owner("Nested", "Qznested", "Rome");
        withPets.addPet(pet("Tom", cat, visit("2024-01-02", "shots"), visit("2024-05-06", "checkup")));
        withPets.addPet(pet("Rex", dog, visit("2023-03-04", "bath")));
        withPets.addPet(pet("Ann", dog));
        persist(withPets);
        persist(owner("Lonely", "Qznested", "Oslo"));
        entityManager.flush();
        entityManager.clear();

        JsonNode page = list("/api/owners?lastName=Qznested");

        assertThat(names(page)).containsExactly("Lonely Qznested", "Nested Qznested");
        assertThat(page.get("content").get(0).get("pets")).isEmpty();
        assertThat(page.get("content").get(1)).isEqualTo(detail(withPets.getId()));
        assertThat(page.get("content").get(1).get("pets")).hasSize(3);
    }

    private List<Integer> traverse(String sort, int total) throws Exception {
        List<Integer> seen = new ArrayList<>();
        for (int pageIndex = 0; pageIndex * 5 < total; pageIndex++) {
            seen.addAll(ids(list("/api/owners?lastName=Qz&size=5&sort=" + sort + "&page=" + pageIndex)));
        }
        return seen;
    }

    private static List<Integer> idsSortedBy(List<Owner> owners, Comparator<Owner> order) {
        return owners.stream().sorted(order).map(Owner::getId).toList();
    }

    // A query parameter, not part of a URI template: the template would re-encode a literal '%'.
    private JsonNode listByLastName(String prefix) throws Exception {
        return list(get("/api/owners").queryParam("lastName", prefix));
    }

    private JsonNode list(String uri) throws Exception {
        return list(get(uri));
    }

    private JsonNode list(MockHttpServletRequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private JsonNode detail(int ownerId) throws Exception {
        return mapper.readTree(mockMvc.perform(get("/api/owners/" + ownerId))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private static List<Integer> ids(JsonNode page) {
        List<Integer> ids = new ArrayList<>();
        page.get("content").forEach(o -> ids.add(o.get("id").asInt()));
        return ids;
    }

    private static List<String> names(JsonNode page) {
        List<String> names = new ArrayList<>();
        page.get("content").forEach(o -> names.add(o.get("firstName").asText() + " " + o.get("lastName").asText()));
        return names;
    }

    private Owner persist(Owner owner) {
        entityManager.persist(owner);
        return owner;
    }

    private static Owner owner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return owner;
    }

    private static Pet pet(String name, PetType type, Visit... visits) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setType(type);
        for (Visit visit : visits) {
            pet.addVisit(visit);
        }
        return pet;
    }

    private static Visit visit(String date, String description) {
        Visit visit = new Visit();
        visit.setDate(LocalDate.parse(date));
        visit.setDescription(description);
        return visit;
    }
}
