package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
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
import victor.training.petclinic.repository.OwnerRepository;

/**
 * The paged owners contract: envelope shape and totals (section 2), deterministic total ordering
 * (section 3) and the guards on the raw {@code Pageable} (section 4).
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerPaginationTest {

    private static final int SEEDED_OWNERS = 28;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void fixtureIsTheUntouchedSeed() {
        assertThat(ownerRepository.count())
            .as("these assertions are written against the migration seed")
            .isEqualTo(SEEDED_OWNERS);
    }

    // ----- section 2: the envelope -----

    @Test
    void firstPageOfAMultiPageResult() throws Exception {
        mockMvc.perform(get("/api/owners?page=0&size=10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(10))
            .andExpect(jsonPath("$.totalElements").value(SEEDED_OWNERS))
            .andExpect(jsonPath("$.totalPages").value(3))
            .andExpect(jsonPath("$.number").value(0))
            .andExpect(jsonPath("$.size").value(10));
    }

    @Test
    void lastPartiallyFilledPage() throws Exception {
        mockMvc.perform(get("/api/owners?page=2&size=10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(8))
            .andExpect(jsonPath("$.number").value(2))
            .andExpect(jsonPath("$.totalElements").value(SEEDED_OWNERS))
            .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void pageBeyondTheEndIsEmptyButStillReportsTotals() throws Exception {
        mockMvc.perform(get("/api/owners?page=99&size=10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(0))
            .andExpect(jsonPath("$.totalElements").value(SEEDED_OWNERS))
            .andExpect(jsonPath("$.totalPages").value(3));
    }

    @Test
    void filterIsAppliedInTheDatabaseAndReflectedInTheTotals() throws Exception {
        JsonNode page = fetch("/api/owners?lastName=Po&page=0&size=5");

        assertThat(page.get("totalElements").asInt())
            .as("Poirot and the two Potters start with Po")
            .isEqualTo(3);
        assertThat(lastNames(page)).allMatch(lastName -> lastName.startsWith("Po"));
    }

    // ----- section 3: deterministic total ordering -----

    @Test
    void nameSortExpandsToLastNameThenFirstName() throws Exception {
        List<String> potters = fullNames(fetch("/api/owners?lastName=Potter&sort=lastName,asc"));

        assertThat(potters).containsExactly("Potter, Beatrix", "Potter, Harry");
    }

    @Test
    void pagesAreStableAcrossTiedSortValues() throws Exception {
        List<Integer> idsAcrossAllPages = new ArrayList<>();
        int pageNumber = 0;
        int totalPages;
        do {
            JsonNode page = fetch("/api/owners?sort=city,asc&size=5&page=" + pageNumber);
            page.get("content").forEach(owner -> idsAcrossAllPages.add(owner.get("id").asInt()));
            totalPages = page.get("totalPages").asInt();
            pageNumber++;
        } while (pageNumber < totalPages);

        assertThat(idsAcrossAllPages)
            .as("walking every page of a tied sort (London x7, Hogsmeade x3) must show each owner once")
            .hasSize(SEEDED_OWNERS)
            .doesNotHaveDuplicates();
    }

    @Test
    void descendingPagesAreAlsoStableAcrossTies() throws Exception {
        // the id tiebreaker follows the sort direction (DESC here); this guards that page stability
        // holds for descending sorts too, not only the ascending path the other test covers
        List<Integer> idsAcrossAllPages = new ArrayList<>();
        int pageNumber = 0;
        int totalPages;
        do {
            JsonNode page = fetch("/api/owners?sort=city,desc&size=5&page=" + pageNumber);
            page.get("content").forEach(owner -> idsAcrossAllPages.add(owner.get("id").asInt()));
            totalPages = page.get("totalPages").asInt();
            pageNumber++;
        } while (pageNumber < totalPages);

        assertThat(idsAcrossAllPages)
            .hasSize(SEEDED_OWNERS)
            .doesNotHaveDuplicates();
    }

    @Test
    void descendingNameSortReversesTheWholeChain() throws Exception {
        List<String> potters = fullNames(fetch("/api/owners?lastName=Potter&sort=lastName,desc"));

        assertThat(potters).containsExactly("Potter, Harry", "Potter, Beatrix");
    }

    @Test
    void defaultsAreAppliedWhenNoParametersAreSupplied() throws Exception {
        JsonNode page = fetch("/api/owners");

        assertThat(page.get("number").asInt()).isEqualTo(0);
        assertThat(page.get("size").asInt()).isEqualTo(10);
        assertThat(lastNames(page))
            .as("the default sort is Name ascending")
            .isSorted();
        assertThat(lastNames(page)).startsWith("Baskerville");
    }

    // ----- section 4: guards -----

    @Test
    void oversizedPageIsClampedToTheMaximum() throws Exception {
        mockMvc.perform(get("/api/owners?size=100000"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.size").value(20))
            .andExpect(jsonPath("$.content.length()").value(20));
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void everyPageSizeOfferedByTheUiIsAcceptedUnclamped(int size) throws Exception {
        mockMvc.perform(get("/api/owners?size=" + size))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.size").value(size))
            .andExpect(jsonPath("$.content.length()").value(size));
    }

    @ParameterizedTest
    @ValueSource(strings = {"bogus", "address", "telephone"})
    void sortingByADisallowedOrUnknownPropertyIsRejected(String property) throws Exception {
        mockMvc.perform(get("/api/owners?sort=" + property + ",asc"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").exists());
    }

    private JsonNode fetch(String uri) throws Exception {
        String json = mockMvc.perform(get(uri))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private List<String> lastNames(JsonNode page) {
        List<String> names = new ArrayList<>();
        page.get("content").forEach(owner -> names.add(owner.get("lastName").asText()));
        return names;
    }

    private List<String> fullNames(JsonNode page) {
        List<String> names = new ArrayList<>();
        page.get("content").forEach(
            owner -> names.add(owner.get("lastName").asText() + ", " + owner.get("firstName").asText()));
        return names;
    }
}
