package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import victor.training.petclinic.DefaultFixture;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

/** GET /api/owners against the 26 seeded owners: paging, sorting, filtering (#25). */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
@DefaultFixture
class OwnerListTest {
    private static final int SEEDED_OWNERS = 26;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper mapper;

    @Test
    void firstPageAndTotal() throws Exception {
        OwnerPageDto page = list("?page=0&size=10");

        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getPage()).isZero();
        assertThat(page.getSize()).isEqualTo(10);
        assertThat(page.getTotalElements()).isEqualTo(SEEDED_OWNERS);
    }

    @Test
    void lastPartialPage() throws Exception {
        assertThat(list("?page=2&size=10").getContent()).hasSize(6);
    }

    @Test
    void pastTheLastPage_isEmptyWithTheTotal() throws Exception {
        OwnerPageDto page = list("?page=9&size=10");

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isEqualTo(SEEDED_OWNERS);
    }

    @Test
    void pagingAppliesAfterTheFilter() throws Exception {
        OwnerPageDto page = list("?lastName=Pot&size=5");

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(names(page)).containsExactly("Beatrix Potter", "Harry Potter");
    }

    @Test
    void prefixFilterIsCaseSensitiveAndAnchored() throws Exception {
        assertThat(list("?lastName=potter").getTotalElements()).isZero();
        assertThat(list("?lastName=otter").getTotalElements()).isZero();
    }

    @Test
    void defaultSizeIs10() throws Exception {
        OwnerPageDto page = list("");

        assertThat(page.getSize()).isEqualTo(10);
        assertThat(page.getContent()).hasSize(10);
    }

    @ParameterizedTest
    @ValueSource(strings = {"size=0", "size=7", "size=21", "size=100000", "page=-1",
            "sort=telephone,asc", "sort=address,asc", "sort=pets,asc", "sort=id,asc",
            "sort=name,up", "sort=name"})
    void rejectsAnythingOutsideTheContract(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query)).andExpect(status().isBadRequest());
    }

    @Test
    void defaultSortIsLastNameThenFirstName() throws Exception {
        List<String> names = names(list("?size=20"));

        assertThat(names).containsSubsequence("Wendy Darling", "Harry Potter"); // D < P, though H < W
        assertThat(names).containsSubsequence("George Darling", "Wendy Darling");
    }

    @Test
    void nameDescendingReversesTheWholeOrder() throws Exception {
        assertThat(names(list("?lastName=Pot&sort=name,desc")))
                .containsExactly("Harry Potter", "Beatrix Potter");
    }

    @Test
    void accentedNamesSortWithTheirBaseLetter() throws Exception {
        List<String> lastNames = allPages("sort=name,asc").stream().map(OwnerDto::getLastName).toList();

        assertThat(lastNames).containsSubsequence("Silver", "Śliwiński", "Tremaine");
    }

    @Test
    void cityDescending_keepsNameAscendingWithinACity() throws Exception {
        List<OwnerDto> owners = allPages("sort=city,desc");

        List<String> cities = owners.stream().map(OwnerDto::getCity).toList();
        assertThat(cities.getFirst()).isEqualTo("Yorkshire");
        assertThat(cities.getLast()).isEqualTo("Bristol");
        assertThat(cities).containsSubsequence("Wigan", "Vienna", "London", "Kraków", "Brussels");
        List<String> londoners = owners.stream()
                .filter(o -> o.getCity().equals("London"))
                .map(o -> o.getLastName() + " " + o.getFirstName())
                .toList();
        assertThat(londoners).isSorted();
    }

    @Test
    void walkingAllPages_seesEveryOwnerExactlyOnce() throws Exception {
        List<OwnerDto> owners = allPages("sort=city,asc&size=5");

        assertThat(owners).extracting(OwnerDto::getId).doesNotHaveDuplicates().hasSize(SEEDED_OWNERS);
        assertThat(allPages("sort=city,asc&size=5")).extracting(OwnerDto::getId)
                .containsExactlyElementsOf(owners.stream().map(OwnerDto::getId).toList());
    }

    @Test
    void ownersCarryTheirPets() throws Exception {
        OwnerDto george = list("?lastName=Darling").getContent().stream()
                .filter(o -> o.getFirstName().equals("George"))
                .findFirst().orElseThrow();

        assertThat(george.getPets()).extracting("name").containsExactlyInAnyOrder("Liza", "Nana");
    }

    private List<OwnerDto> allPages(String query) throws Exception {
        String size = query.contains("size=") ? "" : "&size=5";
        OwnerPageDto first = list("?" + query + size + "&page=0");
        int pages = (int) Math.ceil(first.getTotalElements() / (double) first.getSize());
        List<OwnerDto> all = new ArrayList<>(first.getContent());
        for (int p : IntStream.range(1, pages).toArray()) {
            all.addAll(list("?" + query + size + "&page=" + p).getContent());
        }
        return all;
    }

    private static List<String> names(OwnerPageDto page) {
        return page.getContent().stream().map(o -> o.getFirstName() + " " + o.getLastName()).toList();
    }

    private OwnerPageDto list(String query) throws Exception {
        String json = mockMvc.perform(get("/api/owners" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readValue(json, OwnerPageDto.class);
    }
}
