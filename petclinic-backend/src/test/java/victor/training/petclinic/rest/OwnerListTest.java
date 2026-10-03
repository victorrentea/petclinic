package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
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
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {
    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper();

    record Row(int id, String firstName, String lastName, String city) {
    }

    record Page(List<Row> content, long totalElements) {
    }

    @Test
    void defaultRequest_returnsFirstTenSeedOwnersByNameAndTotal() throws Exception {
        JsonNode body = getJson("/api/owners");

        assertThat(body.isObject()).isTrue();
        assertThat(body.fieldNames()).toIterable().containsExactlyInAnyOrder("content", "totalElements");
        Page page = toPage(body);
        assertThat(page.totalElements()).isEqualTo(26);
        assertThat(page.content()).extracting(Row::lastName).containsExactly(
                "Baskerville", "Carraclough", "Darling", "Darling", "Dickens",
                "Dolittle", "Filch", "Geppetto", "Granger", "Hagrid");
        assertThat(page.content()).extracting(Row::firstName).element(2).isEqualTo("George");
    }

    @Test
    void contentCarriesNestedPetsTypesAndVisits() throws Exception {
        JsonNode body = getJson("/api/owners?lastName=McCallister");

        JsonNode pet = body.get("content").get(0).get("pets").get(0);
        assertThat(pet.get("name").asText()).isEqualTo("Axel");
        assertThat(pet.get("type").get("name").asText()).isNotBlank();
        assertThat(pet.get("visits")).isNotEmpty();
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedSizes(int size) throws Exception {
        Page page = getPage("/api/owners?size=" + size);

        assertThat(page.content()).hasSize(size);
        assertThat(page.totalElements()).isEqualTo(26);
    }

    @Test
    void requestedPage_returnsPositionsSixToTen() throws Exception {
        List<Row> firstTen = getPage("/api/owners?size=10").content();

        Page page = getPage("/api/owners?page=1&size=5");

        assertThat(page.content()).isEqualTo(firstTen.subList(5, 10));
        assertThat(page.totalElements()).isEqualTo(26);
    }

    @Test
    void pageBeyondLast_isEmptyWithActualTotal() throws Exception {
        Page page = getPage("/api/owners?page=100&size=20");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isEqualTo(26);
    }

    @Test
    void noMatch_isEmptyWithZeroTotal() throws Exception {
        Page page = getPage("/api/owners?lastName=NonExistent");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "size=7", "size=0", "size=-5", "size=abc", "size=",
            "page=-1", "page=abc", "page=1.5", "page=", "page=99999999999", "page=2147483647&size=20",
            "sort=lastName,asc", "sort=telephone,asc", "sort=name", "sort=name,up", "sort=",
            "sort=name,asc,city", "sort=NAME,asc", "sort=name,asc&sort=city,desc"})
    void invalidParameters_are400(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest());
    }

    @Test
    void prefixIsCaseSensitiveAndAnchoredAtLastNameStart() throws Exception {
        assertThat(lastNames("/api/owners?lastName=Pot")).containsExactly("Potter", "Potter");
        assertThat(lastNames("/api/owners?lastName=otter")).isEmpty();
        assertThat(lastNames("/api/owners?lastName=Harry")).isEmpty();
        assertThat(lastNames("/api/owners?lastName=potter")).isEmpty();
    }

    @Test
    void wildcardCharactersInPrefixMatchLiterally() throws Exception {
        save("Ann", "Qx_a", "Oslo");
        save("Ann", "Qxba", "Oslo");
        save("Ann", "Qx%c", "Oslo");
        save("Ann", "Qxdd", "Oslo");

        assertThat(lastNames("/api/owners?lastName=Qx_")).containsExactly("Qx_a");
        assertThat(lastNames("/api/owners?lastName=Qx%25")).containsExactly("Qx%c");
    }

    @Test
    void filteredPage_hasFilteredTotal() throws Exception {
        IntStream.range(0, 7).forEach(i -> save("Ann", "Qxfilter" + i, "Oslo"));

        Page page = getPage("/api/owners?lastName=Qxfilter&size=5&page=1");

        assertThat(page.content()).extracting(Row::lastName).containsExactly("Qxfilter5", "Qxfilter6");
        assertThat(page.totalElements()).isEqualTo(7);
    }

    @Test
    void sortByName_bothDirections_breaksTiesByIdAcrossPages() throws Exception {
        List<Owner> owners = saveOrderingFixture();
        Comparator<Owner> byName = Comparator.comparing(Owner::getLastName)
                .thenComparing(Owner::getFirstName).thenComparing(Owner::getId);

        assertThat(traverse("name,asc")).isEqualTo(idsSortedBy(owners, byName));
        assertThat(traverse("name,desc")).isEqualTo(idsSortedBy(owners, byName.reversed()));
    }

    @Test
    void sortByCity_bothDirections_breaksTiesByNameThenIdAcrossPages() throws Exception {
        List<Owner> owners = saveOrderingFixture();
        Comparator<Owner> byCity = Comparator.comparing(Owner::getCity).thenComparing(Owner::getLastName)
                .thenComparing(Owner::getFirstName).thenComparing(Owner::getId);

        assertThat(traverse("city,asc")).isEqualTo(idsSortedBy(owners, byCity));
        assertThat(traverse("city,desc")).isEqualTo(idsSortedBy(owners, byCity.reversed()));
    }

    // 12 owners under one prefix: duplicate full names, shared cities, so every tie breaker is exercised
    private List<Owner> saveOrderingFixture() {
        List<Owner> owners = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            owners.add(save("ann", "Qxsame", "bergen"));
            owners.add(save("bob", "Qxsame", "aarhus"));
            owners.add(save("ann", "Qxother", "aarhus"));
            owners.add(save("cid", "Qxzed", "bergen"));
        }
        return owners;
    }

    private List<Integer> traverse(String sort) throws Exception {
        List<Integer> ids = new ArrayList<>();
        for (int pageIndex = 0; pageIndex < 3; pageIndex++) {
            Page page = getPage("/api/owners?lastName=Qx&size=5&sort=" + sort + "&page=" + pageIndex);
            assertThat(page.totalElements()).isEqualTo(12);
            page.content().forEach(row -> ids.add(row.id()));
        }
        return ids;
    }

    private static List<Integer> idsSortedBy(List<Owner> owners, Comparator<Owner> order) {
        return owners.stream().sorted(order).map(Owner::getId).toList();
    }

    private Owner save(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner);
    }

    private List<String> lastNames(String uri) throws Exception {
        return getPage(uri).content().stream().map(Row::lastName).toList();
    }

    private Page getPage(String uri) throws Exception {
        return toPage(getJson(uri));
    }

    private Page toPage(JsonNode body) throws Exception {
        List<Row> rows = new ArrayList<>();
        for (JsonNode owner : body.get("content")) {
            rows.add(new Row(owner.get("id").asInt(), owner.get("firstName").asText(),
                    owner.get("lastName").asText(), owner.get("city").asText()));
        }
        return new Page(rows, body.get("totalElements").asLong());
    }

    private JsonNode getJson(String uri) throws Exception {
        String json = mockMvc.perform(get(URI.create(uri))) // as-is: a template would re-encode %25
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }
}
