package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Comparator;
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
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerPaginationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper();

    // ---------- 3.2 envelope ----------

    @Test
    void response_isAPageEnvelope_notABareArray() throws Exception {
        mockMvc.perform(get("/api/owners"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.totalElements").exists())
            .andExpect(jsonPath("$.totalPages").exists())
            .andExpect(jsonPath("$.number").value(0))
            .andExpect(jsonPath("$.size").value(10));
    }

    @Test
    void totalsCountTheWholeTable_notThePage() throws Exception {
        long allOwners = ownerRepository.count();

        JsonNode page = getPage("/api/owners?size=10");

        assertThat(page.get("content")).hasSize(10);
        assertThat(page.get("totalElements").asLong()).isEqualTo(allOwners);
        assertThat(page.get("totalPages").asInt()).isEqualTo((int) Math.ceil(allOwners / 10.0));
    }

    // ---------- 3.3 page size ----------

    @Test
    void requestedPageSizesAreHonoured() throws Exception {
        for (int size : List.of(5, 10, 20)) {
            JsonNode page = getPage("/api/owners?size=" + size);

            assertThat(page.get("size").asInt()).isEqualTo(size);
            assertThat(page.get("content").size()).isLessThanOrEqualTo(size);
        }
    }

    @Test
    void oversizedPageRequestIsClampedTo20() throws Exception {
        JsonNode page = getPage("/api/owners?size=1000000");

        assertThat(page.get("size").asInt()).isEqualTo(20);
        assertThat(page.get("content").size()).isLessThanOrEqualTo(20);
    }

    // ---------- 3.4 sorting ----------

    @Test
    void sortByName_ordersByLastThenFirstName() throws Exception {
        ownerRepository.save(anOwner("Zoe", "Darling", "Aberdeen"));
        ownerRepository.save(anOwner("Adam", "Darling", "Aberdeen"));

        List<String> names = fetchAllPages("/api/owners?sort=name,asc").stream()
            .map(owner -> owner.get("lastName").asText() + ", " + owner.get("firstName").asText())
            .toList();

        assertThat(names).isSorted();
        assertThat(names).containsSubsequence("Darling, Adam", "Darling, George", "Darling, Zoe");
    }

    @Test
    void sortByCityDescending() throws Exception {
        List<String> cities = fetchAllPages("/api/owners?sort=city,desc").stream()
            .map(owner -> owner.get("city").asText())
            .toList();

        assertThat(cities).isSortedAccordingTo(Comparator.reverseOrder());
    }

    // ---------- 3.5 sort whitelist ----------

    @Test
    void unknownSortKeyIsRejectedWithBadRequestNamingTheAcceptedKeys() throws Exception {
        String body = mockMvc.perform(get("/api/owners?sort=telephone,asc"))
            .andExpect(status().isBadRequest())
            .andReturn().getResponse().getContentAsString();

        assertThat(body).contains("name").contains("city");
    }

    @Test
    void entityPathSortKeyIsRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=pets.visits.description,asc"))
            .andExpect(status().isBadRequest());
    }

    // ---------- 3.6 default sort ----------

    @Test
    void noSortParameterFallsBackToNameAscending() throws Exception {
        List<JsonNode> withoutSort = fetchAllPages("/api/owners");
        List<JsonNode> withNameAsc = fetchAllPages("/api/owners?sort=name,asc");

        assertThat(idsOf(withoutSort)).isEqualTo(idsOf(withNameAsc));
    }

    // ---------- 3.7 pagination stability (load-bearing) ----------

    @Test
    void pagingOverANonUniqueColumnLosesNothingAndDuplicatesNothing() throws Exception {
        for (String firstName : List.of("Ana", "Bob", "Cleo", "Dan", "Eve", "Flo", "Gus")) {
            ownerRepository.save(anOwner(firstName, "Sharedcity", "Springfield"));
        }
        List<Integer> everyOwnerId = idsOf(fetchAllPages("/api/owners?sort=name,asc&size=20"));

        List<Integer> pagedByCity = idsOf(fetchAllPages("/api/owners?sort=city,asc&size=5"));

        assertThat(pagedByCity).doesNotHaveDuplicates();
        assertThat(pagedByCity).containsExactlyInAnyOrderElementsOf(everyOwnerId);
    }

    // ---------- 3.8 composition ----------

    @Test
    void filterSortAndPageComposeTogether() throws Exception {
        ownerRepository.save(anOwner("Betty", "Davis", "York"));
        ownerRepository.save(anOwner("Harold", "Davis", "Aberdeen"));
        long expectedMatches = ownerRepository.findByLastNameStartingWith("Da").size();

        JsonNode page = getPage("/api/owners?lastName=Da&sort=city,asc&page=0&size=5");

        assertThat(page.get("totalElements").asLong()).isEqualTo(expectedMatches);
        List<JsonNode> matches = fetchAllPages("/api/owners?lastName=Da&sort=city,asc&size=5");
        assertThat(matches).allSatisfy(owner ->
            assertThat(owner.get("lastName").asText()).startsWith("Da"));
        assertThat(matches.stream().map(owner -> owner.get("city").asText()).toList()).isSorted();
    }

    // ---------- helpers ----------

    private Owner anOwner(String firstName, String lastName, String city) {
        return new Owner()
            .setFirstName(firstName)
            .setLastName(lastName)
            .setAddress("some address")
            .setCity(city)
            .setTelephone("1234567890");
    }

    private JsonNode getPage(String uri) throws Exception {
        String json = mockMvc.perform(get(uri))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    /** Walks every page of the given URI, so assertions can be made over the whole result set. */
    private List<JsonNode> fetchAllPages(String uri) throws Exception {
        String separator = uri.contains("?") ? "&" : "?";
        List<JsonNode> all = new ArrayList<>();
        int pageNumber = 0;
        int totalPages;
        do {
            JsonNode page = getPage(uri + separator + "page=" + pageNumber);
            page.get("content").forEach(all::add);
            totalPages = page.get("totalPages").asInt();
            pageNumber++;
        } while (pageNumber < totalPages);
        return all;
    }

    private List<Integer> idsOf(List<JsonNode> owners) {
        return owners.stream().map(owner -> owner.get("id").asInt()).toList();
    }
}
