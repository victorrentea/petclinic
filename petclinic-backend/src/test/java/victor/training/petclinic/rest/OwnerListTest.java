package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.StreamSupport;

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
import victor.training.petclinic.tools.SelectRecorder;

/**
 * GET /api/owners as a page. Its own Spring context (the properties below), hence its own embedded
 * database holding exactly the 26 seeded owners — every fixture here rolls back.
 */
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.session_factory.statement_inspector="
                + "victor.training.petclinic.tools.SelectRecorder",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    EntityManager em;

    final ObjectMapper mapper = new ObjectMapper();

    // ---------- envelope & defaults ----------

    @Test
    void defaultRequest_returnsFirstTenSeededOwnersByName() throws Exception {
        JsonNode page = getPage("/api/owners");

        assertThat(fieldNames(page)).containsExactlyInAnyOrder("content", "totalElements");
        assertThat(page.path("totalElements").asLong()).isEqualTo(26);
        assertThat(fullNames(page)).containsExactly(
                "Henry Baskerville", "Sam Carraclough", "George Darling", "Wendy Darling", "Charles Dickens",
                "John Dolittle", "Argus Filch", "Mister Geppetto", "Hermione Granger", "Rubeus Hagrid");
    }

    @Test
    void requestedPage_returnsThatSlice() throws Exception {
        List<Integer> firstTen = ids(getPage("/api/owners?size=10"));

        JsonNode page = getPage("/api/owners?page=1&size=5");

        assertThat(ids(page)).isEqualTo(firstTen.subList(5, 10));
        assertThat(page.path("totalElements").asLong()).isEqualTo(26);
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedSizes(int size) throws Exception {
        assertThat(getPage("/api/owners?size=" + size).path("content").size()).isEqualTo(size);
    }

    @Test
    void pageBeyondTheLast_isEmptyButKeepsTheTotal() throws Exception {
        JsonNode page = getPage("/api/owners?page=1000");

        assertThat(page.path("content").isEmpty()).isTrue();
        assertThat(page.path("totalElements").asLong()).isEqualTo(26);
    }

    @ParameterizedTest
    @ValueSource(strings = {"size=7", "size=0", "size=-5", "size=abc", "page=-1", "page=abc", "page=1.5",
            "page=99999999999", "page=2147483647&size=20"})
    void invalidPaging_isBadRequest(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query)).andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"lastName,asc", "telephone,asc", "name", "name,up", "name,asc,city,desc", "NAME,asc",
            ",asc", "name,ASC"})
    void unsupportedSort_isBadRequest(String sort) throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", sort)).andExpect(status().isBadRequest());
    }

    // ---------- filtering ----------

    @Test
    void prefixIsCaseSensitiveAndAnchoredAtTheLastName() throws Exception {
        assertThat(fullNames(getPage("/api/owners?lastName=Pot")))
                .containsExactlyInAnyOrder("Harry Potter", "Beatrix Potter");
        for (String miss : List.of("otter", "Harry", "potter")) {
            JsonNode page = getPage("/api/owners?lastName=" + miss);
            assertThat(page.path("content").isEmpty()).as(miss).isTrue();
            assertThat(page.path("totalElements").asLong()).as(miss).isZero();
        }
    }

    @Test
    void filteredPage_countsTheFilteredSet() throws Exception {
        for (int i = 0; i < 7; i++) {
            persistOwner("Ann" + i, "Filtered", "Leeds");
        }
        flushAndClear();

        JsonNode page = getPage("/api/owners?lastName=Filtered&size=5&page=1");

        assertThat(page.path("content").size()).isEqualTo(2);
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void wildcardsInThePrefixMatchLiterally() throws Exception {
        persistOwner("A", "Pe%rcent", "Leeds");
        persistOwner("B", "Pexrcent", "Leeds");
        persistOwner("C", "Un_der", "Leeds");
        persistOwner("D", "Unxder", "Leeds");
        flushAndClear();

        assertThat(fullNames(getPageWithParam("lastName", "Pe%"))).containsExactly("A Pe%rcent");
        assertThat(fullNames(getPageWithParam("lastName", "Un_"))).containsExactly("C Un_der");
    }

    // ---------- ordering ----------

    @Test
    void nameSort_breaksTiesByIdInBothDirections() throws Exception {
        List<Integer> twins = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            twins.add(persistOwner("Dup", "Qxtwin", "Leeds").getId());
        }
        int alpha = persistOwner("Alpha", "Qxtwin", "Leeds").getId();
        int zed = persistOwner("Any", "Qxzed", "Leeds").getId();
        flushAndClear();

        List<Integer> asc = new ArrayList<>(List.of(alpha));
        asc.addAll(twins);
        asc.add(zed);
        assertThat(traverse("lastName=Qx&sort=name,asc&size=5", 5)).isEqualTo(asc);
        assertThat(traverse("lastName=Qx&sort=name,desc&size=5", 5)).isEqualTo(asc.reversed());
    }

    @Test
    void citySort_ordersByCityThenNameThenIdInTheSameDirection() throws Exception {
        int a = persistOwner("Bob", "Qxcity", "Aberdeen").getId();
        int b1 = persistOwner("Ann", "Qxcity", "Bath").getId();
        int b2 = persistOwner("Ann", "Qxcity", "Bath").getId();
        int b3 = persistOwner("Cid", "Qxcity", "Bath").getId();
        int b4 = persistOwner("Ann", "Qxdity", "Bath").getId();
        int c = persistOwner("Ann", "Qxcity", "Cork").getId();
        flushAndClear();

        assertThat(traverse("lastName=Qx&sort=city,asc&size=5", 6)).containsExactly(a, b1, b2, b3, b4, c);
        assertThat(traverse("lastName=Qx&sort=city,desc&size=5", 6)).containsExactly(c, b4, b3, b2, b1, a);
    }

    @Test
    void traversingAllPages_visitsEveryOwnerOnce() throws Exception {
        for (String sort : List.of("name,asc", "name,desc", "city,asc", "city,desc")) {
            List<Integer> seen = traverse("sort=" + sort + "&size=5", 26);
            assertThat(seen).as(sort).doesNotHaveDuplicates().hasSize(26);
        }
    }

    // ---------- nested data & bounded retrieval ----------

    @Test
    void listedOwnerCarriesTheSameNestedDataAsItsDetail() throws Exception {
        Owner rich = ownerWithPets("Rich", "Qnested", 2, 3);
        persistOwner("Poor", "Qnested", "Leeds");
        flushAndClear();

        JsonNode content = getPage("/api/owners?lastName=Qnested").path("content");

        assertThat(fullNames(content)).containsExactly("Poor Qnested", "Rich Qnested");
        assertThat(content.get(0).path("pets").isEmpty()).isTrue();
        JsonNode detail = mapper.readTree(mockMvc.perform(get("/api/owners/" + rich.getId()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(content.get(1)).isEqualTo(detail);
        assertThat(detail.path("pets").get(0).path("visits").size()).isEqualTo(3);
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void fullColdLaterPage_takesAtMostThreeSelects(int size) throws Exception {
        for (int i = 0; i < 2 * size + 1; i++) {
            ownerWithPets("Own" + i, "Qbudget", 2, 2);
        }
        flushAndClear();
        SelectRecorder.reset();

        JsonNode page = getPage("/api/owners?lastName=Qbudget&size=" + size + "&page=1");

        assertThat(page.path("content").size()).isEqualTo(size);
        assertThat(page.path("totalElements").asLong()).isEqualTo(2L * size + 1);
        assertThat(page.path("content").get(0).path("pets").get(0).path("visits").size()).isEqualTo(2);
        assertThat(SelectRecorder.selects()).hasSizeLessThanOrEqualTo(3);
        assertThat(SelectRecorder.selects().getFirst()).containsIgnoringCase("offset").doesNotContain("pets");
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void fullColdFirstPage_takesAtMostThreeSelects(int size) throws Exception {
        for (int i = 0; i < 25; i++) {
            ownerWithPets("Own" + i, "Qbudget", 2, 2);
        }
        flushAndClear();
        SelectRecorder.reset();

        JsonNode page = getPage("/api/owners?lastName=Qbudget&size=" + size);

        assertThat(page.path("content").size()).isEqualTo(size);
        assertThat(page.path("totalElements").asLong()).isEqualTo(25);
        StreamSupport.stream(page.path("content").spliterator(), false).forEach(owner -> {
            assertThat(owner.path("pets").size()).isEqualTo(2);
            owner.path("pets").forEach(pet -> {
                assertThat(pet.path("type").path("name").asText()).isNotEmpty();
                assertThat(pet.path("visits").size()).isEqualTo(2);
            });
        });
        assertThat(SelectRecorder.selects()).hasSizeLessThanOrEqualTo(3);
        assertThat(SelectRecorder.selects().getFirst()).containsIgnoringCase("fetch first").doesNotContain("pets");
    }

    @Test
    void emptyPage_loadsNoPetsOrVisits() throws Exception {
        flushAndClear();
        SelectRecorder.reset();

        getPage("/api/owners?page=1000");

        assertThat(SelectRecorder.selects()).noneMatch(sql -> sql.contains("pets") || sql.contains("visits"));
    }

    // ---------- helpers ----------

    private List<Integer> traverse(String query, int total) throws Exception {
        List<Integer> seen = new ArrayList<>();
        for (int pageIndex = 0; pageIndex <= total; pageIndex++) {
            JsonNode page = getPage("/api/owners?" + query + "&page=" + pageIndex);
            assertThat(page.path("totalElements").asLong()).isEqualTo(total);
            if (page.path("content").isEmpty()) {
                return seen;
            }
            seen.addAll(ids(page));
        }
        throw new AssertionError("Paging never reached an empty page: " + seen);
    }

    private Owner ownerWithPets(String firstName, String lastName, int pets, int visitsPerPet) {
        Owner owner = persistOwner(firstName, lastName, "Leeds");
        for (int p = 0; p < pets; p++) {
            PetType type = new PetType();
            type.setName("type-" + firstName + p);
            em.persist(type);
            Pet pet = new Pet();
            pet.setName("pet" + p);
            pet.setBirthDate(LocalDate.of(2020, 1, 1));
            pet.setType(type);
            owner.addPet(pet);
            em.persist(pet);
            for (int v = 0; v < visitsPerPet; v++) {
                Visit visit = new Visit();
                visit.setDate(LocalDate.of(2024, 1, 1).plusDays(v));
                visit.setDescription("visit" + v);
                pet.addVisit(visit);
                em.persist(visit);
            }
        }
        return owner;
    }

    private Owner persistOwner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        em.persist(owner);
        return owner;
    }

    private void flushAndClear() {
        em.flush();
        em.clear();
    }

    private JsonNode getPage(String uri) throws Exception {
        return mapper.readTree(mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private JsonNode getPageWithParam(String name, String value) throws Exception {
        return mapper.readTree(mockMvc.perform(get("/api/owners").param(name, value))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static List<Integer> ids(JsonNode page) {
        JsonNode content = page.path("content");
        return IntStream.range(0, content.size()).mapToObj(i -> content.get(i).path("id").asInt()).toList();
    }

    private static List<String> fullNames(JsonNode pageOrContent) {
        JsonNode content = pageOrContent.has("content") ? pageOrContent.path("content") : pageOrContent;
        return StreamSupport.stream(content.spliterator(), false)
                .map(o -> o.path("firstName").asText() + " " + o.path("lastName").asText())
                .toList();
    }
}
