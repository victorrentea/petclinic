package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

/** {@code GET /api/owners}: filtered by last-name prefix, one page at a time, in a whitelisted order. */
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
    ObjectMapper mapper;

    @Test
    void prefixMatches() throws Exception {
        saveOwner("Harry", "Potter");
        saveOwner("Beatrix", "Potter");
        saveOwner("George", "Franklin");

        assertThat(fullNames(list("lastName=Pot"))).containsExactlyInAnyOrder("Harry Potter", "Beatrix Potter");
    }

    @Test
    void matchingIsCaseSensitive() throws Exception {
        saveOwner("Harry", "Potter");

        assertThat(list("lastName=potter").getContent()).isEmpty();
    }

    @Test
    void noFilterMatchesEveryone() throws Exception {
        saveOwners(3);

        assertThat(list("").getTotalElements()).isEqualTo(3);
    }

    @Test
    void firstPageByDefault() throws Exception {
        saveOwners(27);

        OwnerPageDto page = list("");

        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getTotalElements()).isEqualTo(27);
        assertThat(page.getTotalPages()).isEqualTo(3);
        assertThat(page.getNumber()).isZero();
        assertThat(page.getSize()).isEqualTo(10);
    }

    @Test
    void lastPartialPage() throws Exception {
        saveOwners(27);

        assertThat(list("page=2&size=10").getContent()).hasSize(7);
    }

    @Test
    void pagePastTheEnd() throws Exception {
        saveOwners(27);

        OwnerPageDto page = list("page=5&size=10");

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isEqualTo(27);
    }

    @Test
    void allowedSize() throws Exception {
        saveOwners(27);

        assertThat(list("size=20").getContent()).hasSize(20);
    }

    @ParameterizedTest
    @ValueSource(strings = {"size=100000", "size=7", "size=0", "page=-1", "sort=telephone", "sort=name,up",
            "sort=pets.name"})
    void invalidPagingIsRejectedWithAProblemDetail(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void defaultOrderIsByName() throws Exception {
        saveOwner("Harry", "Potter");
        saveOwner("Beatrix", "Potter");
        saveOwner("Sherlock", "Holmes");

        assertThat(fullNames(list(""))).containsExactly("Sherlock Holmes", "Beatrix Potter", "Harry Potter");
    }

    @Test
    void sortByCityDescending() throws Exception {
        saveOwnerIn("Vienna");
        saveOwnerIn("London");
        saveOwnerIn("Madrid");

        assertThat(list("sort=city,desc").getContent())
                .extracting(OwnerDto::getCity)
                .containsExactly("Vienna", "Madrid", "London");
    }

    @Test
    void walkingAllPagesListsEveryOwnerExactlyOnce() throws Exception {
        List<Integer> londoners = IntStream.range(0, 12).mapToObj(i -> saveOwnerIn("London")).toList();

        List<Integer> seen = new ArrayList<>();
        for (int pageIndex = 0; pageIndex < 3; pageIndex++) {
            list("sort=city&size=5&page=" + pageIndex).getContent().forEach(owner -> seen.add(owner.getId()));
        }

        assertThat(seen).containsExactlyInAnyOrderElementsOf(londoners);
    }

    @Test
    void accentedInitialSortsNextToItsBaseLetter() throws Exception {
        saveOwner("Wallace", "Wensleydale");
        saveOwner("Łukasz", "Śliwiński");
        saveOwner("Long", "Silver");

        assertThat(list("sort=name").getContent())
                .extracting(OwnerDto::getLastName)
                .containsExactly("Silver", "Śliwiński", "Wensleydale");
    }

    private OwnerPageDto list(String query) throws Exception {
        String json = mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readValue(json, OwnerPageDto.class);
    }

    private static List<String> fullNames(OwnerPageDto page) {
        return page.getContent().stream().map(owner -> owner.getFirstName() + " " + owner.getLastName()).toList();
    }

    private void saveOwners(int count) {
        IntStream.range(0, count).forEach(i -> saveOwner("First" + i, "Last" + i));
    }

    private void saveOwner(String firstName, String lastName) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        ownerRepository.save(owner);
    }

    private int saveOwnerIn(String city) {
        Owner owner = TestData.anOwner();
        owner.setCity(city);
        return ownerRepository.save(owner).getId();
    }
}
