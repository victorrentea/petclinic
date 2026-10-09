package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.stream.StreamSupport;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * The owner-list spec (openspec/changes/paginate-owners-grid/specs/owner-list/spec.md) against the
 * seed dataset: 27 owners. A database of its own, because other test classes commit owners to the
 * shared one, and every assertion here is about exact rows.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY,
        refresh = AutoConfigureEmbeddedDatabase.RefreshMode.BEFORE_CLASS)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListApiTest {
    private static final List<String> ALL_BY_NAME = List.of(
            "Baskerville Henry", "Carraclough Sam", "Darling George", "Darling Wendy", "Dickens Charles",
            "Dolittle John", "Filch Argus", "Geppetto Mister", "Granger Hermione", "Hagrid Rubeus",
            "Holmes Sherlock", "Liddell Alice", "McCallister Kevin", "Mureșan Ștefan", "Potter Beatrix",
            "Potter Harry", "Quixano Alonso", "Radcliff Roger", "Reporter Tintin", "Riddle Tom",
            "Scamander Newt", "Schroedinger Erwin", "Silver Long", "Śliwiński Łukasz", "Șerban Ana",
            "Tremaine Lady", "Wensleydale Wallace");

    @Autowired
    MockMvc mockMvc;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void theFirstPageHoldsTenOwnersByNameWithTheTotals() throws Exception {
        list("")
                .andExpect(jsonPath("$.totalElements").value(27))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10));

        assertThat(names("")).isEqualTo(ALL_BY_NAME.subList(0, 10));
    }

    @Test
    void theLastPageIsPartial() throws Exception {
        assertThat(names("page=2&size=10")).isEqualTo(ALL_BY_NAME.subList(20, 27));
    }

    @Test
    void aPagePastTheEndIsEmptyWithTheTotals() throws Exception {
        list("page=5&size=10")
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(27))
                .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void aListedOwnerCarriesPetsByIdAndNameWithoutVisits() throws Exception {
        JsonNode kevin = owners("lastName=McCallister").get(0);

        assertThat(kevin.path("pets").get(0).path("id").asInt()).isEqualTo(1);
        assertThat(kevin.path("pets").get(0).path("name").asText()).isEqualTo("Axel");
        assertThat(kevin.path("pets").get(0).has("visits")).isFalse();
    }

    @Test
    void theOwnersOwnPageStillCarriesVisits() throws Exception {
        mockMvc.perform(get("/api/owners/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pets[0].visits").isNotEmpty());
    }

    @Test
    void aPageOf100HoldsEveryOwner() throws Exception {
        assertThat(names("size=100")).isEqualTo(ALL_BY_NAME);
    }

    @Test
    void aSizeOver100IsRefused() throws Exception {
        refused("size=101", "size");
    }

    @Test
    void aSizeOfZeroIsRefused() throws Exception {
        refused("size=0", "size");
    }

    @Test
    void aNegativePageIsRefused() throws Exception {
        refused("page=-1", "page");
    }

    @Test
    void sortingByTelephoneIsRefusedListingTheAllowedKeys() throws Exception {
        refused("sort=telephone", "name")
                .andExpect(content().string(containsString("city")));
    }

    @Test
    void anUnknownDirectionIsRefused() throws Exception {
        refused("sort=name,up", "asc");
    }

    @Test
    void ownersWithTheSameLastNameAreOrderedByFirstName() throws Exception {
        List<String> page = names("sort=name&size=20");

        assertThat(page.get(14)).isEqualTo("Potter Beatrix");
        assertThat(page.get(15)).isEqualTo("Potter Harry");
    }

    @Test
    void nameDescendingIsTheExactReverse() throws Exception {
        assertThat(names("sort=name,desc&size=100")).isEqualTo(ALL_BY_NAME.reversed());
    }

    @Test
    void cityAscendingStartsWithBrasov() throws Exception {
        assertThat(citiesAndNames("sort=city,asc").subList(0, 3))
                .containsExactly("Brașov Șerban Ana", "Bristol Silver Long", "Brussels Reporter Tintin");
    }

    @Test
    void ownersInTheSameCityAreOrderedByName() throws Exception {
        assertThat(citiesAndNames("sort=city&size=20"))
                .filteredOn(row -> row.startsWith("London "))
                .containsExactly("London Darling George", "London Darling Wendy", "London Holmes Sherlock",
                        "London Radcliff Roger", "London Scamander Newt");
    }

    @Test
    void cityDescendingReversesTheCitiesButNotTheNames() throws Exception {
        assertThat(citiesAndNames("sort=city,desc").subList(0, 6)).containsExactly(
                "Yorkshire Carraclough Sam", "Winnetka McCallister Kevin", "Wiltshire Riddle Tom",
                "Wigan Wensleydale Wallace", "Vienna Mureșan Ștefan", "Vienna Schroedinger Erwin");
    }

    @Test
    void romanianSAfterEverySAndPolishSWithTheSs() throws Exception {
        List<String> all = names("size=100");

        assertThat(all.subList(all.indexOf("Silver Long"), all.indexOf("Tremaine Lady") + 1))
                .containsExactly("Silver Long", "Śliwiński Łukasz", "Șerban Ana", "Tremaine Lady");
    }

    @Test
    void searchIsAPagedCaseSensitivePrefixOfTheLastName() throws Exception {
        list("lastName=Pot")
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(1));
        assertThat(names("lastName=Pot")).containsExactly("Potter Beatrix", "Potter Harry");

        list("lastName=pot").andExpect(jsonPath("$.totalElements").value(0));
        assertThat(names("lastName=pot")).isEmpty();
    }

    private ResultActions list(String query) throws Exception {
        return mockMvc.perform(get("/api/owners?" + query)).andExpect(status().isOk());
    }

    private ResultActions refused(String query, String named) throws Exception {
        return mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(containsString(named)));
    }

    private List<JsonNode> owners(String query) throws Exception {
        String json = list(query).andReturn().getResponse().getContentAsString();
        return StreamSupport.stream(mapper.readTree(json).path("content").spliterator(), false).toList();
    }

    private List<String> names(String query) throws Exception {
        return owners(query).stream()
                .map(o -> o.path("lastName").asText() + " " + o.path("firstName").asText())
                .toList();
    }

    private List<String> citiesAndNames(String query) throws Exception {
        return owners(query).stream()
                .map(o -> o.path("city").asText() + " " + o.path("lastName").asText() + " "
                        + o.path("firstName").asText())
                .toList();
    }
}
