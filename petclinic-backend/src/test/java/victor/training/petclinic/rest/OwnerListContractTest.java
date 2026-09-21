package victor.training.petclinic.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.repository.OwnerRepository;

/**
 * The contract of GET /api/owners: a page envelope, defaults of 0/10/name,asc, and exactly two
 * sortable keys — anything else is refused at the edge instead of reaching the owner table.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListContractTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @ParameterizedTest
    @ValueSource(strings = {"address", "telephone", "pets.name", "lastName", "nonsense"})
    void aColumnOutsideTheWhitelistIsRefused(String key) throws Exception {
        mockMvc.perform(get("/api/owners?sort=" + key + ",asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(Matchers.allOf(
                        Matchers.containsString("name"), Matchers.containsString("city"))));
    }

    @Test
    void aDirectionOutsideAscOrDescIsRefused() throws Exception {
        mockMvc.perform(get("/api/owners?sort=name,sideways"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void defaultsToTheFirstPageOfTenOrderedByName() throws Exception {
        long seeded = ownerRepository.count();

        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value((int) seeded))
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.content[0].lastName").value("Baskerville"));
    }

    @Test
    void anExplicitPageSizeAndSortIsHonoured() throws Exception {
        long seeded = ownerRepository.count();
        int expectedPages = (int) Math.ceil(seeded / 5.0);

        mockMvc.perform(get("/api/owners?page=1&size=5&sort=city,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.totalElements").value((int) seeded))
                .andExpect(jsonPath("$.totalPages").value(expectedPages))
                .andExpect(jsonPath("$.content.length()").value(5));
    }

    @Test
    void aPageBeyondTheLastIsEmptyButStillCountsEverything() throws Exception {
        long seeded = ownerRepository.count();

        mockMvc.perform(get("/api/owners?page=999&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value((int) seeded));
    }

    @Test
    void theLastNameFilterNarrowsTheTotalBeforePaging() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=Potter"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content[0].firstName").value("Beatrix"))
                .andExpect(jsonPath("$.content[1].firstName").value("Harry"));
    }

    @Test
    void aNegativePageIndexIsRefused() throws Exception {
        mockMvc.perform(get("/api/owners?page=-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(Matchers.containsString("0 or greater")));
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -5, 1001})
    void aPageSizeOutsideOneToAThousandIsRefused(int size) throws Exception {
        mockMvc.perform(get("/api/owners?size=" + size))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(Matchers.containsString("between 1 and 1000")));
    }

    // 1000 is the upper bound *inclusive*: the browser suite asks for ?size=1000 to pull the whole
    // clinic into its fixtures. Tightening this to 999 silently breaks those, hence this test.
    @Test
    void aThousandPerPageIsStillAccepted() throws Exception {
        long seeded = ownerRepository.count();

        mockMvc.perform(get("/api/owners?size=1000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1000))
                .andExpect(jsonPath("$.totalElements").value((int) seeded));
    }
}
