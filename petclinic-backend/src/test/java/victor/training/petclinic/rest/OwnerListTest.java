package victor.training.petclinic.rest;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers `GET /api/owners` against the 28-owner seed data (V3__sample_data.sql), which the
 * openspec change deliberately sized its scenarios against. Every assertion here is a fact
 * about that fixture, not a synthetic dataset, so it stays true only as long as V3 does.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void defaultRequest_isPageZeroSizeTenSortedByNameAsc() throws Exception {
        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(28))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.content[0].lastName").value("Baskerville"))
                .andExpect(jsonPath("$.content[9].lastName").value("Granger"));
    }

    @Test
    void explicitPage_reportsPageNumberAndHoldsItsSlice() throws Exception {
        mockMvc.perform(get("/api/owners?page=2&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(2))
                .andExpect(jsonPath("$.totalElements").value(28))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.content.length()").value(8))
                .andExpect(jsonPath("$.content[0].lastName").value("Riddle"))
                .andExpect(jsonPath("$.content[7].lastName").value("Wensleydale"));
    }

    @Test
    void pagePastTheEnd_returnsOkWithEmptyContentAndTrueTotal() throws Exception {
        mockMvc.perform(get("/api/owners?page=99"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(28));
    }

    @ParameterizedTest
    @ValueSource(strings = {"7", "0", "-1", "100000"})
    void disallowedSize_isRejectedWith400(String size) throws Exception {
        mockMvc.perform(get("/api/owners?size=" + size))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unknownSortField_isRejectedWith400() throws Exception {
        mockMvc.perform(get("/api/owners?sort=address"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unknownDirection_isRejectedWith400() throws Exception {
        mockMvc.perform(get("/api/owners?dir=sideways"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sortNameAsc_ordersByLastNameThenFirstNameThenId() throws Exception {
        mockMvc.perform(get("/api/owners?sort=NAME&dir=asc&size=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].lastName").value("Baskerville"))
                .andExpect(jsonPath("$.content[1].lastName").value("Bond"))
                .andExpect(jsonPath("$.content[2].lastName").value("Carraclough"))
                // the two Darlings prove the first-name tiebreak
                .andExpect(jsonPath("$.content[3].lastName").value("Darling"))
                .andExpect(jsonPath("$.content[3].firstName").value("George"))
                .andExpect(jsonPath("$.content[4].lastName").value("Darling"))
                .andExpect(jsonPath("$.content[4].firstName").value("Wendy"));
    }

    @Test
    void sortNameDesc_reversesTheAscendingOrder() throws Exception {
        mockMvc.perform(get("/api/owners?sort=NAME&dir=desc&size=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].lastName").value("Wensleydale"))
                .andExpect(jsonPath("$.content[1].lastName").value("Weasley"))
                .andExpect(jsonPath("$.content[2].lastName").value("Tremaine"))
                .andExpect(jsonPath("$.content[3].lastName").value("Śliwiński"))
                .andExpect(jsonPath("$.content[4].lastName").value("Silver"));
    }

    @Test
    void sortCity_ordersByCityThenIdTiebreak() throws Exception {
        mockMvc.perform(get("/api/owners?sort=CITY&dir=asc&size=20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].city").value("Bristol"))
                .andExpect(jsonPath("$.content[1].city").value("Brussels"))
                .andExpect(jsonPath("$.content[2].city").value("Dartmoor"))
                .andExpect(jsonPath("$.content[3].city").value("Florence"))
                .andExpect(jsonPath("$.content[4].city").value("Higham"))
                // three Hogsmeade owners: id order (Hagrid 20, Granger 21, Śliwiński 22), not alphabetical
                .andExpect(jsonPath("$.content[5].lastName").value("Hagrid"))
                .andExpect(jsonPath("$.content[6].lastName").value("Granger"))
                .andExpect(jsonPath("$.content[7].lastName").value("Śliwiński"));
    }

    @Test
    void lastNameFilter_combinesWithPagingAndIsCaseSensitive() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=Pot&size=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].firstName").value("Beatrix"))
                .andExpect(jsonPath("$.content[1].firstName").value("Harry"));

        mockMvc.perform(get("/api/owners?lastName=pot"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void petNames_areSortedByName() throws Exception {
        // Roger Radcliff (seed id 6): pets inserted as Pongo, Perdita — insertion order, not alphabetical
        mockMvc.perform(get("/api/owners?lastName=Radcliff"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].petNames[0]").value("Perdita"))
                .andExpect(jsonPath("$.content[0].petNames[1]").value("Pongo"));
    }

    @Test
    void petNames_isEmptyArrayForAPetlessOwner() throws Exception {
        // Hercule Poirot (seed id 13) has no pets in V3
        mockMvc.perform(get("/api/owners?lastName=Poirot"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].petNames.length()").value(0));
    }
}
