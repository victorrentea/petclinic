package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
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
 * How the owner listing orders itself, and what it refuses to order by.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerSortingTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper();

    @Test
    void defaultSort_isByLastNameThenFirstName() throws Exception {
        mockMvc.perform(get("/api/owners?size=20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].lastName").value("Baskerville"))
                .andExpect(jsonPath("$.content[1].lastName").value("Bond"));
    }

    @Test
    void ownersSharingALastName_areOrderedByFirstName() throws Exception {
        List<String> names = namesOf("/api/owners?lastName=Potter&sort=name,asc");

        assertThat(names).containsExactly("Potter, Beatrix", "Potter, Harry");
    }

    @Test
    void sortingByCityDescending() throws Exception {
        List<String> cities = fieldOf("/api/owners?size=20&sort=city,desc", "city");

        assertThat(cities).isSortedAccordingTo((left, right) -> right.compareTo(left));
    }

    /**
     * The clinic's dev database was created with the C collation, which files 'Ś' after
     * 'Z'. A reader looking for Śliwiński runs their finger down the S's, so that is
     * where he has to be — see V9__index_owners.sql, which pins the columns' collation.
     */
    @Test
    void accentedName_sortsWithItsPlainLetter() throws Exception {
        List<String> names = namesOf("/api/owners?size=20&page=1&sort=name,asc");

        assertThat(names).containsSubsequence("Silver, Long", "Śliwiński, Salazar", "Tremaine, Lady");
    }

    @Test
    void unknownSortProperty_isRefusedWithoutLeakingInternals() throws Exception {
        for (String unknown : new String[]{"telephone", "password", "pets"}) {
            mockMvc.perform(get("/api/owners?sort=" + unknown + ",asc"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail").value(not(containsString("Owner"))));
        }
    }

    @Test
    void unknownSortDirection_isRefused() throws Exception {
        mockMvc.perform(get("/api/owners?sort=city,sideways"))
                .andExpect(status().isBadRequest());
    }

    /**
     * Paging shows a slice of an ordered list, so the order has to be total. The seven
     * London owners sit at positions 13-19 of the city sort, which puts them across the
     * page-3/page-4 boundary at size 5 — exactly where a missing tiebreak shows up.
     * (Not the Potters: they are positions 16-17 by name and share a page at 5, 10 and
     * 20 alike, so nothing splits them.)
     */
    @Test
    void walkingEveryPage_listsEachOwnerExactlyOnce() throws Exception {
        long total = ownerRepository.count();

        // By id, not by name: names are not unique here — AddVisitSequenceTest commits
        // a TestData.anOwner(), who is another Sherlock Holmes of London.
        List<String> walked = walkByCity();

        assertThat(walked).hasSize((int) total).doesNotHaveDuplicates();
    }

    @Test
    void repeatingTheWalk_returnsTheSameOrder() throws Exception {
        assertThat(walkByCity()).isEqualTo(walkByCity());
    }

    /** Every owner id, in the order the pages hand them over. */
    private List<String> walkByCity() throws Exception {
        long total = ownerRepository.count();
        List<String> walked = new ArrayList<>();
        for (int page = 0; page * 5 < total; page++) {
            walked.addAll(fieldOf("/api/owners?size=5&sort=city,asc&page=" + page, "id"));
        }
        return walked;
    }

    private List<String> namesOf(String uri) throws Exception {
        List<String> names = new ArrayList<>();
        for (JsonNode owner : content(uri)) {
            names.add(owner.get("lastName").asText() + ", " + owner.get("firstName").asText());
        }
        return names;
    }

    private List<String> fieldOf(String uri, String field) throws Exception {
        List<String> values = new ArrayList<>();
        for (JsonNode owner : content(uri)) {
            values.add(owner.get(field).asText());
        }
        return values;
    }

    private JsonNode content(String uri) throws Exception {
        String json = mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json).get("content");
    }
}
