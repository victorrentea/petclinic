package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.rest.dto.OwnerDto;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The Owners grid's API: pages of 5/10/20, sorted by name or city (#25, specs/owner-list). */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListTest {
    record OwnerPage(List<OwnerDto> content, long totalElements) {
        List<String> names() {
            return content.stream().map(o -> o.getLastName() + ", " + o.getFirstName()).toList();
        }
    }

    @Autowired
    MockMvc mockMvc;
    @Autowired
    ObjectMapper mapper;
    @Autowired
    OwnerRepository ownerRepository;

    private int anOwner(String lastName, String firstName, String city) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        owner.setFirstName(firstName);
        owner.setCity(city);
        return ownerRepository.save(owner).getId();
    }

    private void owners(int count) {
        for (int i = 0; i < count; i++) {
            anOwner("Owner" + i, "Ada", "London");
        }
    }

    private OwnerPage list(String query) throws Exception {
        String json = mockMvc.perform(get("/api/owners" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readValue(json, OwnerPage.class);
    }

    @Test
    void firstPageOfTenByDefault() throws Exception {
        owners(23);

        OwnerPage page = list("");

        assertThat(page.content()).hasSize(10);
        assertThat(page.totalElements()).isEqualTo(23);
    }

    @Test
    void lastPageIsPartial() throws Exception {
        owners(23);

        OwnerPage page = list("?page=2&size=10");

        assertThat(page.content()).hasSize(3);
        assertThat(page.totalElements()).isEqualTo(23);
    }

    @Test
    void pagePastTheEndIsEmpty() throws Exception {
        owners(23);

        OwnerPage page = list("?page=9&size=10");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isEqualTo(23);
    }

    @Test
    void pageSizeIsFiveTenOrTwenty() throws Exception {
        mockMvc.perform(get("/api/owners?size=50000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("5, 10 or 20")));
    }

    @Test
    void negativePageIsRefused() throws Exception {
        mockMvc.perform(get("/api/owners?page=-1"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sortsOnlyByNameOrCity() throws Exception {
        mockMvc.perform(get("/api/owners?sort=telephone,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", containsString("name")))
                .andExpect(jsonPath("$.detail", containsString("city")));
    }

    @Test
    void sortsByLastThenFirstNameByDefault() throws Exception {
        anOwner("Potter", "Harry", "Little Whinging");
        anOwner("Darling", "Wendy", "London");
        anOwner("Darling", "George", "London");

        assertThat(list("").names()).containsExactly("Darling, George", "Darling, Wendy", "Potter, Harry");
        assertThat(list("?sort=name,desc").names())
                .containsExactly("Potter, Harry", "Darling, Wendy", "Darling, George");
    }

    @Test
    void sortsByCityThenNameAscending() throws Exception {
        anOwner("Holmes", "Sherlock", "London");
        anOwner("Mureșan", "Ștefan", "Vienna");
        anOwner("Darling", "Wendy", "London");

        assertThat(list("?sort=city,asc").names())
                .containsExactly("Darling, Wendy", "Holmes, Sherlock", "Mureșan, Ștefan");
        assertThat(list("?sort=city,desc").names())
                .containsExactly("Mureșan, Ștefan", "Darling, Wendy", "Holmes, Sherlock");
    }

    @Test
    void namesakesAppearOnceAcrossPages() throws Exception {
        for (int i = 0; i < 6; i++) {
            anOwner("Lovelace", "Ada", "London");
        }

        for (String sort : new String[]{"name,asc", "name,desc", "city,asc", "city,desc"}) {
            List<Integer> ids = new ArrayList<>();
            ids.addAll(list("?size=5&page=0&sort=" + sort).content().stream().map(OwnerDto::getId).toList());
            ids.addAll(list("?size=5&page=1&sort=" + sort).content().stream().map(OwnerDto::getId).toList());
            assertThat(ids).as(sort).hasSize(6).doesNotHaveDuplicates();
        }
    }

    @Test
    void searchByLastNamePrefixPagesToo() throws Exception {
        owners(21);
        anOwner("Darling", "Wendy", "London");
        anOwner("Darwin", "Charles", "Shrewsbury");

        OwnerPage page = list("?lastName=Dar&size=5");

        assertThat(page.names()).containsExactly("Darling, Wendy", "Darwin, Charles");
        assertThat(page.totalElements()).isEqualTo(2);
    }

    @Test
    void aLastNameNobodyHasFindsAnEmptyPage() throws Exception {
        owners(3);

        OwnerPage page = list("?lastName=Zzz");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isZero();
    }
}
