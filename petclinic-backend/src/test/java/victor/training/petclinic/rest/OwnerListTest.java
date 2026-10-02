package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.StreamSupport;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

/** The page contract of GET /api/owners, against the 26 seeded owners plus a few of its own. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {

    private static final List<String> SEEDED_FIRST_TEN_BY_NAME = List.of(
            "Henry Baskerville", "Sam Carraclough", "George Darling", "Wendy Darling", "Charles Dickens",
            "John Dolittle", "Argus Filch", "Mister Geppetto", "Hermione Granger", "Rubeus Hagrid");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void defaultRequest_returnsFirstTenByNameAndTheTotal() throws Exception {
        JsonNode page = getPage("/api/owners");

        assertThat(fullNames(page)).containsExactlyElementsOf(SEEDED_FIRST_TEN_BY_NAME);
        assertThat(page.path("totalElements").asLong()).isEqualTo(ownerRepository.count()).isEqualTo(26);
    }

    @Test
    void envelope_hasExactlyContentAndTotalElements() throws Exception {
        JsonNode page = getPage("/api/owners");

        assertThat(page.isObject()).isTrue();
        List<String> fields = new ArrayList<>();
        page.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("content", "totalElements");
    }

    @Test
    void ownerDto_keepsItsNestedPets() throws Exception {
        JsonNode potters = getPage("/api/owners?lastName=Potter&sort=name,desc").path("content");

        JsonNode harry = potters.get(0);
        assertThat(harry.path("firstName").asText()).isEqualTo("Harry");
        assertThat(harry.path("pets").get(0).path("name").asText()).isEqualTo("Hedwig");
        assertThat(harry.path("pets").get(0).path("type").path("name").asText()).isEqualTo("bird");
        assertThat(harry.path("pets").get(0).has("visits")).isTrue();
    }

    @Test
    void requestedPage_returnsPositionsSixToTen() throws Exception {
        JsonNode page = getPage("/api/owners?page=1&size=5");

        assertThat(fullNames(page)).containsExactlyElementsOf(SEEDED_FIRST_TEN_BY_NAME.subList(5, 10));
        assertThat(page.path("totalElements").asLong()).isEqualTo(26);
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void allowedSizes(int size) throws Exception {
        JsonNode page = getPage("/api/owners?size=" + size);

        assertThat(page.path("content").size()).isEqualTo(size);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "size=7", "size=0", "size=-5", "size=100", "size=abc",
            "page=-1", "page=abc", "page=1.5", "page=99999999999"})
    void invalidPaging_isBadRequest(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "lastName,asc", "telephone,asc", "id,asc", "name", "name,up", "city,", ",asc",
            "name,asc,city,asc", "NAME,asc", "name,ASC"})
    void unsupportedSort_isBadRequest(String sort) throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", sort))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"page", "sort"})
    void rejectedValue_isNotEchoedBack(String parameter) throws Exception {
        String forged = "x\n2026-10-03 ERROR <script>forged</script>";

        String body = mockMvc.perform(get("/api/owners").param(parameter, forged))
                .andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("forged");
    }

    @Test
    void repeatedSortParameter_isBadRequest() throws Exception {
        mockMvc.perform(get("/api/owners").param("sort", "name,asc").param("sort", "city,desc"))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "name,desc", "city,asc", "city,desc"})
    void supportedSorts(String sort) throws Exception {
        JsonNode page = getPage("/api/owners?sort=" + sort);

        assertThat(page.path("content").size()).isEqualTo(10);
    }

    @Test
    void pageBeyondTheLast_isEmptyButKeepsTheTotal() throws Exception {
        JsonNode page = getPage("/api/owners?page=3");

        assertThat(page.path("content").isEmpty()).isTrue();
        assertThat(page.path("totalElements").asLong()).isEqualTo(26);
    }

    @Test
    void pageWhoseRowOffsetOverflows_isBadRequestNotAServerError() throws Exception {
        mockMvc.perform(get("/api/owners?size=20&page=" + Integer.MAX_VALUE))
                .andExpect(status().isBadRequest());
    }

    @Test
    void emptyLastName_matchesEveryOwner() throws Exception {
        assertThat(getPage("/api/owners?lastName=").path("totalElements").asLong()).isEqualTo(26);
    }

    @Test
    void lastNamePrefix_isCaseSensitiveAndAnchoredAtTheStart() throws Exception {
        assertThat(fullNames(getPage("/api/owners?lastName=Pot")))
                .containsExactly("Beatrix Potter", "Harry Potter");

        for (String miss : List.of("otter", "Harry", "potter")) {
            JsonNode page = getPage("/api/owners?lastName=" + miss);
            assertThat(page.path("content").isEmpty()).as(miss).isTrue();
            assertThat(page.path("totalElements").asLong()).as(miss).isZero();
        }
    }

    @Test
    void filteredPage_countsTheWholeFilteredSet() throws Exception {
        IntStream.rangeClosed(1, 7).forEach(i -> save("Ann", "Septimus" + i));

        JsonNode page = getPage("/api/owners?lastName=Septimus&size=5&page=1");

        assertThat(fullNames(page)).containsExactly("Ann Septimus6", "Ann Septimus7");
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
    }

    @Test
    void sqlWildcardsInThePrefix_matchLiterally() throws Exception {
        save("Uma", "Under_score");
        save("Pam", "Per%cent");

        assertThat(fullNames(searchLastName("Under_"))).containsExactly("Uma Under_score");
        assertThat(fullNames(searchLastName("Per%"))).containsExactly("Pam Per%cent");
        assertThat(searchLastName("P_tter").path("totalElements").asLong()).isZero();
        assertThat(searchLastName("%").path("totalElements").asLong()).isZero();
    }

    private void save(String firstName, String lastName) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        ownerRepository.save(owner);
    }

    private JsonNode getPage(String uri) throws Exception {
        return getPage(get(uri));
    }

    private JsonNode searchLastName(String lastName) throws Exception {
        return getPage(get("/api/owners").param("lastName", lastName));
    }

    private JsonNode getPage(MockHttpServletRequestBuilder request) throws Exception {
        String json = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<String> fullNames(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(o -> o.path("firstName").asText() + " " + o.path("lastName").asText())
                .toList();
    }
}
