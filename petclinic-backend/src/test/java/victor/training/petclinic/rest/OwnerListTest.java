package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;

/**
 * GET /api/owners as a page. Every test lists only owners whose last name starts with "Zpg",
 * so the seed rows never interfere, and all names are plain lowercase ASCII after a capital,
 * so the order is the same under a C and an en_US collation.
 */
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
    @Autowired
    PetRepository petRepository;
    @Autowired
    PetTypeRepository petTypeRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    private Owner owner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner);
    }

    /** Zpga … Zpgl, first name Ann, city in reverse order of the last name. */
    private void twelveOwners() {
        for (char c = 'a'; c <= 'l'; c++) {
            owner("Ann", "Zpg" + c, "City" + (char) ('z' - (c - 'a')));
        }
    }

    private JsonNode list(String query) throws Exception {
        String json = mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<String> names(JsonNode page) {
        List<String> names = new ArrayList<>();
        for (JsonNode row : page.path("content")) {
            names.add(row.path("lastName").asText() + " " + row.path("firstName").asText());
        }
        return names;
    }

    private static List<Integer> ids(JsonNode page) {
        List<Integer> ids = new ArrayList<>();
        for (JsonNode row : page.path("content")) {
            ids.add(row.path("id").asInt());
        }
        return ids;
    }

    @Test
    void defaults_firstPageOfTenSortedByNameAscending() throws Exception {
        twelveOwners();

        JsonNode page = list("lastName=Zpg");

        assertThat(page.path("totalElements").asLong()).isEqualTo(12);
        assertThat(page.path("totalPages").asInt()).isEqualTo(2);
        assertThat(page.path("number").asInt()).isZero();
        assertThat(page.path("size").asInt()).isEqualTo(10);
        assertThat(names(page)).containsExactly(
                "Zpga Ann", "Zpgb Ann", "Zpgc Ann", "Zpgd Ann", "Zpge Ann",
                "Zpgf Ann", "Zpgg Ann", "Zpgh Ann", "Zpgi Ann", "Zpgj Ann");
    }

    @Test
    void noParameters_listsEveryOwnerInPagesOfTen() throws Exception {
        JsonNode page = list("");

        long total = ownerRepository.count();
        assertThat(page.path("totalElements").asLong()).isEqualTo(total);
        assertThat(page.path("totalPages").asInt()).isEqualTo((int) Math.ceil(total / 10.0));
        assertThat(page.path("content")).hasSize(10);
    }

    @ParameterizedTest
    @CsvSource({"5,5,3", "10,10,2", "20,12,1"})
    void eachAllowedPageSize(int size, int expectedRows, int expectedPages) throws Exception {
        twelveOwners();

        JsonNode page = list("lastName=Zpg&size=" + size);

        assertThat(page.path("content")).hasSize(expectedRows);
        assertThat(page.path("size").asInt()).isEqualTo(size);
        assertThat(page.path("totalPages").asInt()).isEqualTo(expectedPages);
    }

    @Test
    void filterThenPage() throws Exception {
        twelveOwners();

        JsonNode page = list("lastName=Zpg&page=1&size=5");

        assertThat(page.path("number").asInt()).isEqualTo(1);
        assertThat(names(page)).containsExactly("Zpgf Ann", "Zpgg Ann", "Zpgh Ann", "Zpgi Ann", "Zpgj Ann");
    }

    @Test
    void filterIsACaseSensitivePrefix() throws Exception {
        twelveOwners();
        owner("Ann", "Xzpg", "Citya");

        assertThat(list("lastName=zpg").path("totalElements").asLong()).isZero();
        assertThat(list("lastName=Zpgb").path("totalElements").asLong()).isEqualTo(1);
    }

    @Test
    void sortByName_tiesOnLastNameBrokenByFirstName() throws Exception {
        owner("Bob", "Zpgb", "Citya");
        owner("Ann", "Zpgb", "Cityb");
        owner("Cid", "Zpga", "Cityc");

        assertThat(names(list("lastName=Zpg&sort=name&direction=asc")))
                .containsExactly("Zpga Cid", "Zpgb Ann", "Zpgb Bob");
        assertThat(names(list("lastName=Zpg&sort=name&direction=desc")))
                .containsExactly("Zpgb Bob", "Zpgb Ann", "Zpga Cid");
    }

    @Test
    void sortByCity_tiesBrokenByLastThenFirstName() throws Exception {
        owner("Bob", "Zpgb", "Citya");
        owner("Ann", "Zpgb", "Citya");
        owner("Ann", "Zpga", "Citya");
        owner("Ann", "Zpgc", "Cityb");

        assertThat(names(list("lastName=Zpg&sort=city&direction=asc")))
                .containsExactly("Zpga Ann", "Zpgb Ann", "Zpgb Bob", "Zpgc Ann");
        assertThat(names(list("lastName=Zpg&sort=city&direction=desc")))
                .containsExactly("Zpgc Ann", "Zpgb Bob", "Zpgb Ann", "Zpga Ann");
    }

    @ParameterizedTest
    @ValueSource(strings = {"size=7", "page=-1", "sort=telephone", "direction=up", "sort=NAME", "page=x"})
    void invalidParameter_isABadRequestProblem(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors[0]").value(not(containsString("java."))));
    }

    @Test
    void identicalNamesAcrossAPageBoundary_eachListedOnce() throws Exception {
        List<Integer> created = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            created.add(owner("Ann", "Zpgsame", "Citya").getId());
        }

        List<Integer> seen = new ArrayList<>(ids(list("lastName=Zpg&size=5&page=0")));
        seen.addAll(ids(list("lastName=Zpg&size=5&page=1")));

        assertThat(seen).containsExactlyInAnyOrderElementsOf(created);
    }

    @ParameterizedTest
    @CsvSource({"name,asc", "name,desc", "city,asc", "city,desc"})
    void walkingEveryPage_yieldsEveryOwnerOnce(String sort, String direction) throws Exception {
        List<Integer> created = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            created.add(owner("Ann", "Zpg" + (char) ('a' + i % 3), "City" + (char) ('a' + i % 2)).getId());
        }

        List<Integer> seen = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            seen.addAll(ids(list("lastName=Zpg&size=5&sort=" + sort + "&direction=" + direction + "&page=" + page)));
        }

        assertThat(seen).containsExactlyInAnyOrderElementsOf(created);
    }

    @Test
    void row_carriesPetNamesSortedAndNoVisits() throws Exception {
        Owner owner = owner("Ann", "Zpga", "Citya");
        var type = petTypeRepository.save(TestData.aPetType("zpgtype"));
        for (String name : List.of("Rex", "Bella")) {
            Pet pet = TestData.aPet();
            pet.setName(name);
            pet.setType(type);
            owner.addPet(pet);
            petRepository.save(pet);
        }

        mockMvc.perform(get("/api/owners?lastName=Zpga"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(owner.getId()))
                .andExpect(jsonPath("$.content[0].address").value("Baker St 221B"))
                .andExpect(jsonPath("$.content[0].city").value("Citya"))
                .andExpect(jsonPath("$.content[0].telephone").value("1234567890"))
                .andExpect(jsonPath("$.content[0].petNames").value(contains("Bella", "Rex")))
                .andExpect(jsonPath("$.content[0]", not(hasKey("pets"))))
                .andExpect(jsonPath("$.content[0]", not(hasKey("visits"))));
    }
}
