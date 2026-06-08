package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.transaction.Transactional;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.repository.OwnerRepository;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerPaginationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void seedOwners() {
        // Insert enough owners (with varied last names + cities) to exercise paging and sorting.
        String[] lastNames = {"Zimmer", "Adams", "Murphy", "Baker", "Young", "Carter",
            "Nelson", "Diaz", "Olsen", "Evans", "Parker", "Foster", "Quinn"};
        String[] cities = {"Yonkers", "Boston", "Austin", "Denver", "Chicago", "Seattle",
            "Dallas", "Portland", "Reno", "Miami", "Tampa", "Akron", "Newark"};
        for (int i = 0; i < lastNames.length; i++) {
            Owner owner = TestData.anOwner()
                .setFirstName("First" + i)
                .setLastName(lastNames[i])
                .setCity(cities[i]);
            ownerRepository.save(owner);
        }
    }

    private JsonNode getPage(String uri) throws Exception {
        MvcResult result = mockMvc.perform(get(uri))
            .andExpect(status().isOk())
            .andReturn();
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    private List<String> field(JsonNode page, String name) {
        List<String> values = new ArrayList<>();
        page.get("content").forEach(node -> values.add(node.get(name).asText()));
        return values;
    }

    @Test
    void defaultPage_returnsEnvelope_size10_number0_sortedByLastNameAsc() throws Exception {
        JsonNode page = getPage("/api/owners");

        assertThat(page.has("content")).isTrue();
        assertThat(page.has("totalElements")).isTrue();
        assertThat(page.has("totalPages")).isTrue();
        assertThat(page.get("size").asInt()).isEqualTo(10);
        assertThat(page.get("number").asInt()).isZero();
        assertThat(page.get("content").size()).isEqualTo(10);

        List<String> lastNames = field(page, "lastName");
        assertThat(lastNames).isSorted();
    }

    @Test
    void honoursPageAndSizeParams() throws Exception {
        JsonNode page = getPage("/api/owners?page=2&size=5");

        assertThat(page.get("number").asInt()).isEqualTo(2);
        assertThat(page.get("size").asInt()).isEqualTo(5);
    }

    @Test
    void sortByCityDescending() throws Exception {
        JsonNode page = getPage("/api/owners?sort=city,desc");

        List<String> cities = field(page, "city");
        assertThat(cities).isSortedAccordingTo((a, b) -> b.compareTo(a));
    }

    @Test
    void oversizedPageSizeIsClampedToMax20() throws Exception {
        JsonNode page = getPage("/api/owners?size=500");

        assertThat(page.get("size").asInt()).isEqualTo(20);
    }

    @Test
    void invalidSortField_fallsBackToLastNameAsc_not500() throws Exception {
        JsonNode page = getPage("/api/owners?sort=telephone,asc");

        List<String> lastNames = field(page, "lastName");
        assertThat(lastNames).isSorted();
    }

    @Test
    void sortByName_expandsToLastNameThenFirstName() throws Exception {
        // Two owners sharing a last name; firstName must break the tie.
        ownerRepository.save(TestData.anOwner().setLastName("Ztie").setFirstName("Bruno"));
        ownerRepository.save(TestData.anOwner().setLastName("Ztie").setFirstName("Anna"));

        JsonNode page = getPage("/api/owners?lastName=Ztie&sort=name,asc");

        List<String> firstNames = field(page, "firstName");
        assertThat(firstNames).containsExactly("Anna", "Bruno");
    }
}
