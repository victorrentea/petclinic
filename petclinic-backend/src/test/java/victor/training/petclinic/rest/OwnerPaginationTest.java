package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import victor.training.petclinic.repository.OwnerRepository;

/**
 * Pagination and sorting of GET /api/owners, over the Flyway-seeded owners only.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerPaginationTest {
    private static final int PAGE_SIZE_CAP = 20;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper();

    @Test
    void defaultsToTenRowsOnTheFirstPage() throws Exception {
        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.page.size").value(10))
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.page.totalElements").value((int) ownerRepository.count()));
    }

    @Test
    void rowsCarryNoPets() throws Exception {
        mockMvc.perform(get("/api/owners").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").exists())
                .andExpect(jsonPath("$.content[0].firstName").exists())
                .andExpect(jsonPath("$.content[0].lastName").exists())
                .andExpect(jsonPath("$.content[0].address").exists())
                .andExpect(jsonPath("$.content[0].city").exists())
                .andExpect(jsonPath("$.content[0].pets").doesNotExist());
    }

    @Test
    void firstMiddleAndLastPageDoNotOverlap() throws Exception {
        List<Integer> firstPage = idsOf(page(0, 5));
        List<Integer> middlePage = idsOf(page(1, 5));
        List<Integer> lastPage = idsOf(page(lastPageNumber(5), 5));

        assertThat(firstPage).hasSize(5);
        assertThat(middlePage).hasSize(5).doesNotContainAnyElementsOf(firstPage);
        assertThat(lastPage).isNotEmpty().doesNotContainAnyElementsOf(firstPage);
    }

    @Test
    void pageSizeAtTheCapIsAccepted() throws Exception {
        mockMvc.perform(get("/api/owners").param("size", String.valueOf(PAGE_SIZE_CAP)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(PAGE_SIZE_CAP));
    }

    @Test
    void pageSizeAboveTheCapIsRejected() throws Exception {
        mockMvc.perform(get("/api/owners").param("size", String.valueOf(PAGE_SIZE_CAP + 1)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pagePastTheEndIsEmptyButNotAnError() throws Exception {
        mockMvc.perform(get("/api/owners").param("page", "900"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.page.totalElements").value((int) ownerRepository.count()));
    }

    /**
     * The seed holds Darling x2 and Potter x2. Without `id` closing the ORDER BY, LIMIT/OFFSET is
     * free to return one of a tied pair on two consecutive pages and skip the other entirely.
     */
    @Test
    void walkingEveryPageVisitsEachOwnerExactlyOnce() throws Exception {
        List<Integer> seen = new ArrayList<>();
        for (int page = 0; page <= lastPageNumber(5); page++) {
            seen.addAll(idsOf(page(page, 5)));
        }

        assertThat(seen)
                .hasSize((int) ownerRepository.count())
                .doesNotHaveDuplicates();
    }

    @Test
    void sortsByNameAlphabetically() throws Exception {
        // page 0 of the seed is entirely ASCII, so Java's own ordering is a fair oracle here
        assertThat(valuesOf(sorted("NAME", "ASC", 0), "lastName")).isSorted();
    }

    @Test
    void sortsByCityAlphabetically() throws Exception {
        assertThat(valuesOf(sorted("CITY", "ASC", 0), "city")).isSorted();
    }

    @Test
    void descendingIsExactlyTheReverseOfAscending() throws Exception {
        for (String field : List.of("NAME", "CITY")) {
            List<Integer> ascending = allIds(field, "ASC");

            assertThat(allIds(field, "DESC"))
                    .as("%s descending", field)
                    .containsExactlyElementsOf(reversed(ascending));
        }
    }

    /**
     * Guards the decision to sort without an explicit COLLATE: this cluster is en_US.UTF-8, so
     * 'Śliwiński' belongs inside the S block. A re-initdb under the C collation would drop it to
     * the very end of the list, and this test - not a client - is what should notice.
     */
    @Test
    void diacriticsSortAccordingToTheClusterCollation() throws Exception {
        List<String> lastNames = valuesOf(allRows("NAME", "ASC"), "lastName");

        assertThat(lastNames).contains("Śliwiński");
        assertThat(lastNames.indexOf("Śliwiński")).isEqualTo(lastNames.indexOf("Silver") + 1);
    }

    @Test
    void lastNameFilterStaysACaseSensitivePrefixAndDrivesTheTotals() throws Exception {
        mockMvc.perform(get("/api/owners").param("lastName", "Pot").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].lastName").value("Potter"))
                .andExpect(jsonPath("$.page.totalElements").value(2));

        mockMvc.perform(get("/api/owners").param("lastName", "potter"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(0));
    }

    @Test
    void unsupportedSortFieldIsRejectedAsClientError() throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", "BANANA"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unsupportedSortDirectionIsRejectedAsClientError() throws Exception {
        mockMvc.perform(get("/api/owners").param("dir", "SIDEWAYS"))
                .andExpect(status().isBadRequest());
    }

    private int lastPageNumber(int size) {
        return (int) ((ownerRepository.count() - 1) / size);
    }

    private JsonNode page(int page, int size) throws Exception {
        return contentOf(get("/api/owners")
                .param("page", String.valueOf(page))
                .param("size", String.valueOf(size)));
    }

    private JsonNode sorted(String sort, String dir, int page) throws Exception {
        return contentOf(get("/api/owners")
                .param("sort", sort)
                .param("dir", dir)
                .param("page", String.valueOf(page))
                .param("size", String.valueOf(PAGE_SIZE_CAP)));
    }

    private JsonNode allRows(String sort, String dir) throws Exception {
        com.fasterxml.jackson.databind.node.ArrayNode all = mapper.createArrayNode();
        for (int page = 0; page <= lastPageNumber(PAGE_SIZE_CAP); page++) {
            all.addAll((com.fasterxml.jackson.databind.node.ArrayNode) sorted(sort, dir, page));
        }
        return all;
    }

    private List<Integer> allIds(String sort, String dir) throws Exception {
        return idsOf(allRows(sort, dir));
    }

    private JsonNode contentOf(MockHttpServletRequestBuilder request) throws Exception {
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).get("content");
    }

    private List<Integer> idsOf(JsonNode content) {
        List<Integer> ids = new ArrayList<>();
        content.forEach(row -> ids.add(row.get("id").asInt()));
        return ids;
    }

    private List<String> valuesOf(JsonNode content, String field) {
        List<String> values = new ArrayList<>();
        content.forEach(row -> values.add(row.get(field).asText()));
        return values;
    }

    private List<Integer> reversed(List<Integer> ids) {
        List<Integer> copy = new ArrayList<>(ids);
        Collections.reverse(copy);
        return copy;
    }
}
