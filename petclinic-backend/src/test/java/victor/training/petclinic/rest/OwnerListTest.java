package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

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

/** GH #25: GET /api/owners answers one page at a time, sorted by name or city. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {
    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;
    ObjectMapper mapper = new ObjectMapper();

    private void owners(int count) {
        IntStream.range(0, count).forEach(i -> owner("First" + i, "Last%02d".formatted(i), "City"));
    }

    private Owner owner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner);
    }

    private JsonNode page(String url) throws Exception {
        String json = mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private List<String> lastNames(JsonNode page) {
        List<String> names = new ArrayList<>();
        page.get("content").forEach(owner -> names.add(owner.get("lastName").asText()));
        return names;
    }

    @Test
    void defaultsToFirst10ByName() throws Exception {
        owners(26);

        JsonNode page = page("/api/owners");

        assertThat(lastNames(page)).containsExactly(
                "Last00", "Last01", "Last02", "Last03", "Last04", "Last05", "Last06", "Last07", "Last08", "Last09");
        assertThat(page.get("number").asInt()).isZero();
        assertThat(page.get("size").asInt()).isEqualTo(10);
        assertThat(page.get("totalElements").asLong()).isEqualTo(26);
        assertThat(page.get("totalPages").asInt()).isEqualTo(3);
    }

    @Test
    void laterPage() throws Exception {
        owners(26);

        JsonNode page = page("/api/owners?page=2&size=10");

        assertThat(lastNames(page)).containsExactly("Last20", "Last21", "Last22", "Last23", "Last24", "Last25");
        assertThat(page.get("number").asInt()).isEqualTo(2);
    }

    @Test
    void pagePastTheEnd_isEmptyWithTotals() throws Exception {
        owners(26);

        JsonNode page = page("/api/owners?page=99&size=10");

        assertThat(page.get("content")).isEmpty();
        assertThat(page.get("totalElements").asLong()).isEqualTo(26);
        assertThat(page.get("totalPages").asInt()).isEqualTo(3);
    }

    @Test
    void sizeAboveMax_400() throws Exception {
        mockMvc.perform(get("/api/owners?size=500"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("size must be between 1 and 20"));
    }

    @Test
    void sizeZero_400() throws Exception {
        mockMvc.perform(get("/api/owners?size=0")).andExpect(status().isBadRequest());
    }

    @Test
    void negativePage_400() throws Exception {
        mockMvc.perform(get("/api/owners?page=-1")).andExpect(status().isBadRequest());
    }

    @Test
    void sortByCityDescending() throws Exception {
        owner("A", "Holmes", "London");
        owner("B", "Mureșan", "Vienna");
        owner("C", "Liddell", "Oxford");

        JsonNode page = page("/api/owners?sort=city,desc");

        assertThat(lastNames(page)).containsExactly("Mureșan", "Liddell", "Holmes");
    }

    @Test
    void unsupportedSortKey_400() throws Exception {
        mockMvc.perform(get("/api/owners?sort=telephone"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]")
                        .value("sort must be name or city, optionally followed by ,asc or ,desc"));
    }

    @Test
    void identicalOwnersAppearExactlyOnceAcrossPages() throws Exception {
        List<Integer> kevins = IntStream.range(0, 15)
                .mapToObj(i -> owner("Kevin", "McCallister", "Winnetka").getId())
                .toList();

        List<Integer> seen = new ArrayList<>();
        for (int pageNo = 0; pageNo < 2; pageNo++) {
            page("/api/owners?size=10&page=" + pageNo).get("content")
                    .forEach(owner -> seen.add(owner.get("id").asInt()));
        }

        assertThat(seen).containsExactlyElementsOf(kevins);
    }

    @Test
    void diacriticsSortNextToTheirBaseLetter() throws Exception {
        owner("Long", "Tremaine", "Paris");
        owner("Łukasz", "Śliwiński", "Kraków");
        owner("John", "Silver", "Bristol");
        owner("Wallace", "Wensleydale", "Wigan");

        assertThat(lastNames(page("/api/owners?sort=name")))
                .containsExactly("Silver", "Śliwiński", "Tremaine", "Wensleydale");
    }

    @Test
    void searchIsPagedWithMatchingTotals() throws Exception {
        owner("Harry", "Potter", "Little Whinging");
        owner("Beatrix", "Potter", "Near Sawrey");
        owner("Sherlock", "Holmes", "London");

        JsonNode page = page("/api/owners?lastName=Po&size=1");

        assertThat(lastNames(page)).containsExactly("Potter");
        assertThat(page.get("totalElements").asLong()).isEqualTo(2);
        assertThat(page.get("totalPages").asInt()).isEqualTo(2);
    }
}
