package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.repository.OwnerRepository;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListPaginationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    private int save(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner()
            .setFirstName(firstName)
            .setLastName(lastName)
            .setCity(city);
        return ownerRepository.save(owner).getId();
    }

    // --- envelope & defaults -------------------------------------------------

    @Test
    void defaults_returnPageEnvelope_size10_page0() throws Exception {
        mockMvc.perform(get("/api/owners"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.size").value(10))
            .andExpect(jsonPath("$.number").value(0))
            .andExpect(jsonPath("$.totalElements").isNumber());
    }

    @Test
    void explicitPageSize_isHonored() throws Exception {
        mockMvc.perform(get("/api/owners?page=0&size=5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.size").value(5));
    }

    // --- whitelist rejection (end-to-end through the advice) -----------------

    @Test
    void disallowedSize_is400() throws Exception {
        mockMvc.perform(get("/api/owners?size=7")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/owners?size=1000000")).andExpect(status().isBadRequest());
    }

    @Test
    void disallowedSort_is400() throws Exception {
        mockMvc.perform(get("/api/owners?sort=address")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/owners?sort=telephone")).andExpect(status().isBadRequest());
    }

    @Test
    void disallowedDirection_is400() throws Exception {
        mockMvc.perform(get("/api/owners?dir=up")).andExpect(status().isBadRequest());
    }

    // --- ordering ------------------------------------------------------------

    @Test
    void nameSort_caseInsensitive_lastThenFirst() throws Exception {
        save("Amy", "Qzapple", "London");
        save("Zoe", "QZapple", "London");   // same last name ignoring case
        save("Tom", "Qzbanana", "London");

        // Grouped case-insensitively by last name (Qzapple == QZapple), then first name: Amy, Zoe, Tom
        mockMvc.perform(get("/api/owners?lastName=Qz&sort=name&dir=asc&size=20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[*].firstName", contains("Amy", "Zoe", "Tom")));
    }

    @Test
    void nameSort_descending() throws Exception {
        save("Amy", "Qzapple", "London");
        save("Zoe", "QZapple", "London");
        save("Tom", "Qzbanana", "London");

        mockMvc.perform(get("/api/owners?lastName=Qz&sort=name&dir=desc&size=20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[*].firstName", contains("Tom", "Zoe", "Amy")));
    }

    @Test
    void equalKeys_tieBrokenByIdAscending() throws Exception {
        int first = save("Sam", "Qzcherry", "London");
        int second = save("sam", "Qzcherry", "London");   // identical ignoring case

        mockMvc.perform(get("/api/owners?lastName=Qzcherry&sort=name&size=20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[*].id", contains(first, second)));
    }

    @Test
    void citySort_caseInsensitive() throws Exception {
        save("A", "Czowner", "Zurich");
        save("B", "Czowner", "amsterdam");
        save("C", "Czowner", "Berlin");

        mockMvc.perform(get("/api/owners?lastName=Cz&sort=city&dir=asc&size=20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[*].city", contains("amsterdam", "Berlin", "Zurich")));
    }

    // --- search + paging -----------------------------------------------------

    @Test
    void search_isCaseInsensitive() throws Exception {
        save("Wanda", "Wobble", "London");

        mockMvc.perform(get("/api/owners?lastName=wobble&size=20"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[*].lastName", contains("Wobble")));
    }

    @Test
    void search_combinesWithPaging() throws Exception {
        // size is whitelisted to {5,10,20}; use 6 rows over size=5 to span two pages
        for (char c = 'A'; c <= 'F'; c++) {
            save(String.valueOf(c), "Pzowner", "London");
        }

        mockMvc.perform(get("/api/owners?lastName=Pz&size=5&page=0"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(6))
            .andExpect(jsonPath("$.totalPages").value(2))
            .andExpect(jsonPath("$.content.length()").value(5));

        mockMvc.perform(get("/api/owners?lastName=Pz&size=5&page=1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(1));
    }

    // --- repository method directly ------------------------------------------

    @Test
    void repository_pagesByLastNamePrefix() {
        save("A", "Rzowner", "London");
        save("B", "Rzowner", "London");

        Page<Owner> page = ownerRepository.findPageByLastNamePrefix(
            "Rz", PageRequest.of(0, 20, Sort.by("id")));

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).extracting(Owner::getLastName).containsOnly("Rzowner");
    }
}
