package victor.training.petclinic.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.repository.OwnerRepository;

/**
 * The owner listing is paged: one page of rows plus the totals a pager needs.
 * Sorting, its tiebreak and its validation live in {@link OwnerSortingTest}.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerPagingTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Test
    void bareRequest_returnsFirstPageOfTenWithTotals() throws Exception {
        long seeded = ownerRepository.count();

        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(seeded))
                .andExpect(jsonPath("$.totalPages").value((int) Math.ceil(seeded / 10.0)));
    }

    @Test
    void everyOwnerOnThePageCarriesItsPets() throws Exception {
        mockMvc.perform(get("/api/owners?sort=name,asc"))
                .andExpect(status().isOk())
                // Baskerville, Henry owns the Hound of the Baskervilles
                .andExpect(jsonPath("$.content[0].pets.length()").value(1))
                .andExpect(jsonPath("$.content[0].pets[0].name").value("Baskerville"));
    }

    @Test
    void laterPage_returnsTheNextSlice() throws Exception {
        mockMvc.perform(get("/api/owners?page=1&size=10&sort=name,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.content[0].lastName").value("Hagrid"));
    }

    @Test
    void lastPage_isShort() throws Exception {
        long seeded = ownerRepository.count();
        int lastPage = (int) Math.ceil(seeded / 10.0) - 1;
        int expectedRows = (int) (seeded - lastPage * 10L);

        mockMvc.perform(get("/api/owners?page=" + lastPage + "&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(expectedRows));
    }

    @Test
    void pageBeyondTheEnd_isEmptyButKeepsTheTotals() throws Exception {
        long seeded = ownerRepository.count();

        mockMvc.perform(get("/api/owners?page=99&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.totalElements").value(seeded))
                .andExpect(jsonPath("$.totalPages").value((int) Math.ceil(seeded / 10.0)));
    }

    @Test
    void filterNarrowsTheTotals() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=Pot"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content.length()").value(2));
    }

    @Test
    void offeredPageSizesAreHonoured() throws Exception {
        for (int size : new int[]{5, 10, 20}) {
            mockMvc.perform(get("/api/owners?size=" + size))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.size").value(size))
                    .andExpect(jsonPath("$.content.length()").value(size));
        }
    }

    @Test
    void unsupportedPageSize_isRefused() throws Exception {
        mockMvc.perform(get("/api/owners?size=1000"))
                .andExpect(status().isBadRequest());
    }
}
