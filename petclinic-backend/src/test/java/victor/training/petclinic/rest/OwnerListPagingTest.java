package victor.training.petclinic.rest;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Comparator;
import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.repository.OwnerRepository;

/**
 * The wire contract of GET /api/owners: an OwnerPageDto page, a validated sort allowlist,
 * and clamped view-state parameters.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListPagingTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    // ---------- 3.1 defaults ----------

    @Test
    void defaultsToFirstPageOfTenOrderedByNameAscending() throws Exception {
        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.totalElements").value((int) ownerRepository.count()));

        assertThat(fullNames("/api/owners")).isEqualTo(fullNames("/api/owners?sort=name,asc"));
    }

    @Test
    void aPageIsTheRequestedSliceOfTheOrderedResult() throws Exception {
        List<String> all = fullNames("/api/owners?page=0&size=20&sort=name,asc");

        mockMvc.perform(get("/api/owners?page=2&size=5&sort=name,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(2))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.content.length()").value(5));

        assertThat(fullNames("/api/owners?page=2&size=5&sort=name,asc"))
                .isEqualTo(all.subList(10, 15));
    }

    // ---------- 3.2 every sortable column, both directions, plus the tiebreaker ----------

    @Test
    void sortsByNameInBothDirections() throws Exception {
        assertThat(lastNames("/api/owners?size=20&sort=name,asc")).isSorted();
        assertThat(lastNames("/api/owners?size=20&sort=name,DESC"))
                .isSortedAccordingTo(Comparator.reverseOrder());
    }

    @Test
    void sortsByCityInBothDirections() throws Exception {
        assertThat(this.<String>field("/api/owners?size=20&sort=city,asc", "city")).isSorted();
        assertThat(this.<String>field("/api/owners?size=20&sort=city,desc", "city"))
                .isSortedAccordingTo(Comparator.reverseOrder());
    }

    @Test
    void sortsByPetCountInBothDirections() throws Exception {
        assertThat(this.<Integer>field("/api/owners?size=20&sort=petCount,asc", "petCount")).isSorted();
        assertThat(this.<Integer>field("/api/owners?size=20&sort=petCount,desc", "petCount"))
                .isSortedAccordingTo((a, b) -> b - a);
    }

    @Test
    void tiesAreBrokenByNameSoPagingIsDeterministic() throws Exception {
        List<String> londoners = fullNames("/api/owners?size=20&sort=city,asc").stream()
                .filter(n -> londonFullNames().contains(n))
                .toList();

        assertThat(londoners).containsExactlyElementsOf(londonFullNames());
    }

    @Test
    void theTwoPottersComeBackNameOrdered() throws Exception {
        assertThat(fullNames("/api/owners?lastName=Potter&sort=name,asc"))
                .containsExactly("Beatrix Potter", "Harry Potter");
    }

    @Test
    void repeatingTheSameRequestReturnsTheSameOrder() throws Exception {
        String url = "/api/owners?page=1&size=5&sort=petCount,desc";
        assertThat(fullNames(url)).isEqualTo(fullNames(url));
    }

    // ---------- 3.3 validation ----------

    @Test
    void pageBeyondTheEndIsAnEmptyPageReportingTheTrueTotal() throws Exception {
        mockMvc.perform(get("/api/owners?page=99999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.number").value(99999))
                .andExpect(jsonPath("$.totalElements").value((int) ownerRepository.count()));
    }

    @Test
    void negativePageIsClampedToTheFirstPage() throws Exception {
        mockMvc.perform(get("/api/owners?page=-3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(0));
    }

    @Test
    void oversizedPageSizeIsClampedToTwenty() throws Exception {
        mockMvc.perform(get("/api/owners?size=1000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.content.length()").value(20));
    }

    @Test
    void unsupportedPageSizeFallsBackToTheLargestSupportedSizeBelowIt() throws Exception {
        mockMvc.perform(get("/api/owners?size=7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(5));
    }

    @Test
    void pageSizeBelowTheSmallestSupportedSizeIsRaisedToIt() throws Exception {
        mockMvc.perform(get("/api/owners?size=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(5));
    }

    @Test
    void sortingByANonSortableColumnIsRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=telephone,asc"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sortingByAnUnknownNameIsRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=lastName,asc"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/owners?sort=wibble,asc"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anUnknownSortDirectionIsRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=name,sideways"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sortDirectionIsCaseInsensitive() throws Exception {
        mockMvc.perform(get("/api/owners?sort=name,ASC")).andExpect(status().isOk());
        mockMvc.perform(get("/api/owners?sort=name,Desc")).andExpect(status().isOk());
    }

    // ---------- 3.4 the total counts the filter, not the table ----------

    @Test
    void theTotalReflectsTheLastNameFilterNotTheTableSize() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=Potter"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    /** Pinning a collation changes ordering only; prefix matching stays case-sensitive as before. */
    @Test
    void searchRemainsCaseSensitiveJustAsBefore() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=potter"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    // ---------- helpers ----------

    private static List<String> londonFullNames() {
        return List.of("James Bond", "George Darling", "Wendy Darling", "Sherlock Holmes",
                "Hercule Poirot", "Roger Radcliff", "Newt Scamander");
    }

    private String body(String url) throws Exception {
        return mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private <T> List<T> field(String url, String name) throws Exception {
        return JsonPath.read(body(url), "$.content[*]." + name);
    }

    private List<String> lastNames(String url) throws Exception {
        return field(url, "lastName");
    }

    /** Both names out of one response: each body() is a fresh request and a fresh round trip. */
    private List<String> fullNames(String url) throws Exception {
        String json = body(url);
        List<String> first = JsonPath.read(json, "$.content[*].firstName");
        List<String> last = JsonPath.read(json, "$.content[*].lastName");
        return IntStream.range(0, first.size())
                .mapToObj(i -> first.get(i) + " " + last.get(i))
                .toList();
    }
}
