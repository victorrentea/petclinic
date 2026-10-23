package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;

/** GET /api/owners: paged, sorted, filtered. Not @Transactional: every method starts on a fresh empty DB. */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListingTest {

    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;
    @Autowired
    PetRepository petRepository;
    @Autowired
    PetTypeRepository petTypeRepository;

    @Test
    void firstPageOfALargerList() throws Exception {
        givenOwnersNumbered(12);

        mockMvc.perform(get("/api/owners?page=0&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(10)))
                .andExpect(jsonPath("$.totalElements").value(12));
    }

    @Test
    void lastPartialPage() throws Exception {
        givenOwnersNumbered(12);

        mockMvc.perform(get("/api/owners?page=1&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(12));
    }

    @Test
    void pagePastTheEnd() throws Exception {
        givenOwnersNumbered(12);

        mockMvc.perform(get("/api/owners?page=5&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", empty()))
                .andExpect(jsonPath("$.totalElements").value(12));
    }

    @Test
    void defaultsToFirstPageOfTenByNameAscending() throws Exception {
        givenOwnersNumbered(25);

        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(10)))
                .andExpect(jsonPath("$.content[0].firstName").value("Owner01"))
                .andExpect(jsonPath("$.content[9].firstName").value("Owner10"))
                .andExpect(jsonPath("$.totalElements").value(25));
    }

    @Test
    void eachOwnerStillCarriesItsPets() throws Exception {
        Owner owner = givenOwner("Jean", "Coleman");
        PetType cat = petTypeRepository.save(TestData.aPetType("cat-" + System.nanoTime()));
        givenPet(owner, "Leo", cat);
        givenPet(owner, "Basil", cat);

        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].pets[*].name", containsInAnyOrder("Leo", "Basil")));
    }

    @Test
    void nameSortsByFirstNameThenLastName() throws Exception {
        givenOwner("Harry", "Potter");
        givenOwner("Beatrix", "Potter");
        givenOwner("Albus", "Dumbledore");

        mockMvc.perform(get("/api/owners?sort=name&dir=asc"))
                .andExpect(jsonPath("$.content[*].firstName", contains("Albus", "Beatrix", "Harry")));
    }

    @Test
    void nameSortsDescending() throws Exception {
        givenOwner("Albus", "Dumbledore");
        givenOwner("Harry", "Potter");

        mockMvc.perform(get("/api/owners?sort=name&dir=desc"))
                .andExpect(jsonPath("$.content[*].firstName", contains("Harry", "Albus")));
    }

    @Test
    void ownersWithTheSameNameStayApartAcrossPages() throws Exception {
        List<Integer> ids = IntStream.range(0, 6).mapToObj(i -> givenOwner("Wendy", "Darling").getId()).toList();

        List<Integer> seen = new ArrayList<>(idsOnPage("/api/owners?sort=name&page=0&size=5"));
        seen.addAll(idsOnPage("/api/owners?sort=name&page=1&size=5"));

        assertThat(seen).containsExactlyInAnyOrderElementsOf(ids);
    }

    @Test
    void citySortsWithAStableTieBreaker() throws Exception {
        List<Integer> londonIds = IntStream.range(0, 5)
                .mapToObj(i -> givenOwner("Owner" + i, "Smith", "London").getId()).toList();
        Owner bath = givenOwner("Jane", "Austen", "Bath");

        List<Integer> page0 = idsOnPage("/api/owners?sort=city&dir=asc&page=0&size=5");
        List<Integer> page1 = idsOnPage("/api/owners?sort=city&dir=asc&page=1&size=5");

        assertThat(page0.get(0)).isEqualTo(bath.getId());
        assertThat(Stream.concat(page0.stream().skip(1), page1.stream()))
                .containsExactlyInAnyOrderElementsOf(londonIds);
    }

    @Test
    void accentedLettersSortNextToTheirBaseLetter() throws Exception {
        givenOwner("Ann", "Wensleydale");
        givenOwner("Ann", "Śliwiński");
        givenOwner("Ann", "Smith");

        mockMvc.perform(get("/api/owners?sort=name&dir=asc"))
                .andExpect(jsonPath("$.content[*].lastName", contains("Śliwiński", "Smith", "Wensleydale")));
    }

    @Test
    void lastNameFilterAppliesBeforePaging() throws Exception {
        givenOwner("George", "Franklin");
        givenOwner("Betty", "Davis");
        givenOwner("Harold", "Davis");

        mockMvc.perform(get("/api/owners?lastName=Dav&size=5"))
                .andExpect(jsonPath("$.content[*].lastName", contains("Davis", "Davis")))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void lastNameFilterMatchingNothing() throws Exception {
        givenOwner("George", "Franklin");

        mockMvc.perform(get("/api/owners?lastName=Zzzz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", empty()))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"size=50000", "size=7", "page=-1", "page=abc",
            "sort=telephone", "sort=address", "sort=first_name", "dir=up"})
    void rejectsAnInvalidParameter(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation Error"))
                .andExpect(jsonPath("$.errors", not(empty())));
    }

    private List<Integer> idsOnPage(String uri) throws Exception {
        String json = mockMvc.perform(get(uri)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return JsonPath.read(json, "$.content[*].id");
    }

    private void givenOwnersNumbered(int count) {
        // Inserted in reverse so a passing order cannot come from insertion order.
        IntStream.rangeClosed(1, count).map(i -> count + 1 - i)
                .forEach(i -> givenOwner("Owner%02d".formatted(i), "Smith"));
    }

    private Owner givenOwner(String firstName, String lastName) {
        return givenOwner(firstName, lastName, "London");
    }

    private Owner givenOwner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner);
    }

    private void givenPet(Owner owner, String name, PetType type) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setOwner(owner);
        pet.setType(type);
        petRepository.save(pet);
    }
}
