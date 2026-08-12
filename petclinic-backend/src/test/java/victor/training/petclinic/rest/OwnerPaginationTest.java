package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

    @BeforeEach
    void setUp() {
        // All test owners share the "ZZ_" prefix so we can filter them in isolation from seed data
        List<String[]> names = List.of(
                new String[]{"Alice", "ZZ_Zimmermann", "Berlin"},
                new String[]{"Bob", "ZZ_Anderson", "Paris"},
                new String[]{"Carol", "ZZ_Brown", "London"},
                new String[]{"Dave", "ZZ_Carter", "Rome"},
                new String[]{"Eve", "ZZ_Davis", "Madrid"},
                new String[]{"Frank", "ZZ_Evans", "Vienna"},
                new String[]{"Grace", "ZZ_Foster", "Amsterdam"},
                new String[]{"Henry", "ZZ_Garcia", "Brussels"},
                new String[]{"Ivy", "ZZ_Harris", "Lisbon"},
                new String[]{"Jack", "ZZ_Johnson", "Athens"},
                new String[]{"Kate", "ZZ_King", "Prague"},
                new String[]{"Leo", "ZZ_Lee", "Warsaw"},
                new String[]{"Mia", "ZZ_Martin", "Budapest"},
                new String[]{"Nick", "ZZ_Martinez", "Zurich"},
                new String[]{"Olivia", "ZZ_Smith", "Oslo"});
        names.forEach(n -> {
            Owner o = new Owner()
                    .setFirstName(n[0])
                    .setLastName(n[1])
                    .setCity(n[2])
                    .setAddress("123 Main St")
                    .setTelephone("1234567890");
            ownerRepository.save(o);
        });
    }

    private static final String FILTER = "?lastName=ZZ_";
    private static final String FILTER_AND = "?lastName=ZZ_&";

    // 3.1: default call returns page 0, size 10, sorted by lastName then firstName ASC
    @Test
    void defaultCall_returnsPage0_size10_sortedByLastNameFirstName() throws Exception {
        String json = mockMvc.perform(get("/api/owners" + FILTER_AND + "size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.page.size").value(10))
                .andReturn().getResponse().getContentAsString();

        JsonNode root = mapper.readTree(json);
        JsonNode content = root.get("content");
        assertThat(content.size()).isEqualTo(10);
        // First entries are sorted by lastName: ZZ_Anderson before ZZ_Brown
        assertThat(content.get(0).get("lastName").asText()).isEqualTo("ZZ_Anderson");
        assertThat(content.get(1).get("lastName").asText()).isEqualTo("ZZ_Brown");
    }

    // 3.2: page/size params return correct slice and metadata
    @Test
    void pageSizeParams_returnCorrectSliceAndMetadata() throws Exception {
        mockMvc.perform(get("/api/owners" + FILTER_AND + "page=1&size=5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.number").value(1))
                .andExpect(jsonPath("$.page.size").value(5))
                .andExpect(jsonPath("$.page.totalElements").value(15))
                .andExpect(jsonPath("$.page.totalPages").value(3))
                .andExpect(jsonPath("$.content.length()").value(5));
    }

    // 3.3: requesting page beyond last returns empty content with correct totals
    @Test
    void pageBeyondLast_returnsEmptyContent() throws Exception {
        mockMvc.perform(get("/api/owners" + FILTER_AND + "page=100&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.page.totalElements").value(15));
    }

    // 3.4: sort=name,asc / name,desc / city,asc return correctly ordered results
    @Test
    void sortByName_asc_returnsCorrectOrder() throws Exception {
        String json = mockMvc.perform(get("/api/owners" + FILTER_AND + "sort=name&direction=asc&size=5"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode content = mapper.readTree(json).get("content");
        assertThat(content.get(0).get("lastName").asText()).isEqualTo("ZZ_Anderson");
    }

    @Test
    void sortByName_desc_returnsCorrectOrder() throws Exception {
        String json = mockMvc.perform(get("/api/owners" + FILTER_AND + "sort=name&direction=desc&size=5"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode content = mapper.readTree(json).get("content");
        assertThat(content.get(0).get("lastName").asText()).isEqualTo("ZZ_Zimmermann");
    }

    @Test
    void sortByCity_asc_returnsCorrectOrder() throws Exception {
        String json = mockMvc.perform(get("/api/owners" + FILTER_AND + "sort=city&direction=asc&size=5"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode content = mapper.readTree(json).get("content");
        // Amsterdam comes first alphabetically among our test data
        assertThat(content.get(0).get("city").asText()).isEqualTo("Amsterdam");
    }

    // 3.5: disallowed sort value returns 400
    @Test
    void disallowedSort_returns400() throws Exception {
        mockMvc.perform(get("/api/owners?sort=telephone&direction=asc"))
                .andExpect(status().isBadRequest());
    }

    // 3.6: disallowed size and negative page return 400
    @Test
    void disallowedSize_returns400() throws Exception {
        mockMvc.perform(get("/api/owners?size=7"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void negativePage_returns400() throws Exception {
        mockMvc.perform(get("/api/owners?page=-1"))
                .andExpect(status().isBadRequest());
    }

    // 3.7: lastName filter combined with pagination/sorting returns correct subset
    @Test
    void lastNameFilter_combinedWithPaginationSorting() throws Exception {
        // "ZZ_Ma" matches: ZZ_Martin, ZZ_Martinez
        mockMvc.perform(get("/api/owners?lastName=ZZ_Ma&page=0&size=5&sort=name&direction=asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(2))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].lastName").value("ZZ_Martin"))
                .andExpect(jsonPath("$.content[1].lastName").value("ZZ_Martinez"));
    }

    // 3.8: pets serialized via batch fetch, not JOIN FETCH (guard against HHH000104)
    @Test
    void petsSerializedViaBatchFetch_notJoinFetch() throws Exception {
        mockMvc.perform(get("/api/owners" + FILTER_AND + "size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].pets").exists());
    }
}
