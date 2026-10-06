package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

// Each test creates owners under its own last name, then filters on it, so that the seed
// and other tests' rows never shift the expected page contents.
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
    EntityManager entityManager;

    ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void defaultPage_isTheFirstTenByName() throws Exception {
        List<String> firstNames = List.of("Lia", "Kim", "Jo", "Ian", "Hal", "Gus", "Fay", "Eve", "Dan", "Cy", "Bo",
                "Al");
        firstNames.forEach(first -> owner(first, "Pager", "London"));

        OwnerPageDto page = list("?lastName=Pager");

        assertThat(page.number()).isZero();
        assertThat(page.size()).isEqualTo(10);
        assertThat(page.totalElements()).isEqualTo(12);
        assertThat(page.totalPages()).isEqualTo(2);
        assertThat(page.content()).extracting(OwnerDto::getFirstName)
                .containsExactly("Al", "Bo", "Cy", "Dan", "Eve", "Fay", "Gus", "Hal", "Ian", "Jo");
    }

    @Test
    void unfilteredTotal_countsEveryOwner() throws Exception {
        OwnerPageDto page = list("");

        assertThat(page.totalElements()).isEqualTo(ownerRepository.count());
        assertThat(page.content()).hasSize(10);
    }

    @Test
    void lastPartialPage() throws Exception {
        IntStream.range(0, 12).forEach(i -> owner("Owner" + i, "Pager", "London"));

        OwnerPageDto page = list("?lastName=Pager&page=1&size=10");

        assertThat(page.content()).hasSize(2);
        assertThat(page.number()).isEqualTo(1);
    }

    @Test
    void pagePastTheEnd_isEmptyWithTotals() throws Exception {
        IntStream.range(0, 12).forEach(i -> owner("Owner" + i, "Pager", "London"));

        OwnerPageDto page = list("?lastName=Pager&page=50&size=10");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isEqualTo(12);
        assertThat(page.totalPages()).isEqualTo(2);
    }

    @Test
    void sizeAtTheCap_isAccepted() throws Exception {
        assertThat(list("?size=100").content()).hasSizeLessThanOrEqualTo(100);
    }

    @Test
    void sizeAboveTheCap_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?size=101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(containsString("size")));
    }

    @Test
    void sizeZero_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?size=0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(containsString("size")));
    }

    @Test
    void negativePage_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?page=-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(containsString("page")));
    }

    @Test
    void sortByName_putsFirstNamesFirst() throws Exception {
        owner("Harry", "Pagerpotter", "London");
        owner("Beatrix", "Pagerpotter", "Near Sawrey");

        OwnerPageDto page = list("?lastName=Pagerpotter&sort=name,asc");

        assertThat(page.content()).extracting(OwnerDto::getFirstName).containsExactly("Beatrix", "Harry");
    }

    @Test
    void sortByCityDescending_thenByName() throws Exception {
        owner("Wendy", "Citysort", "London");
        owner("Wallace", "Citysort", "Wigan");
        owner("George", "Citysort", "London");
        owner("Erwin", "Citysort", "Vienna");

        OwnerPageDto page = list("?lastName=Citysort&sort=city,desc");

        assertThat(page.content()).extracting(OwnerDto::getFirstName)
                .containsExactly("Wallace", "Erwin", "George", "Wendy");
    }

    @Test
    void accentedNames_sortAlphabetically() throws Exception {
        owner("Mister", "Accent", "Florence");
        owner("Łukasz", "Accent", "Kraków");
        owner("Long", "Accent", "Bristol");

        OwnerPageDto page = list("?lastName=Accent&sort=name");

        assertThat(page.content()).extracting(OwnerDto::getFirstName).containsExactly("Long", "Łukasz", "Mister");
    }

    @Test
    void unsupportedSortKey_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=telephone,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value(allOf(containsString("name"), containsString("city"))));
    }

    @Test
    void identicalOwners_onAPageBoundary_appearExactlyOnce() throws Exception {
        List<Integer> ids = IntStream.range(0, 11).mapToObj(i -> owner("Ada", "Lovelace", "London").getId()).toList();

        List<Integer> seen = new ArrayList<>();
        seen.addAll(idsOn(list("?lastName=Lovelace&size=10&page=0&sort=city")));
        seen.addAll(idsOn(list("?lastName=Lovelace&size=10&page=1&sort=city")));

        assertThat(seen).containsExactlyElementsOf(ids);
    }

    @Test
    void lastNameFilter_appliesBeforePaging() throws Exception {
        owner("Harry", "Pagerpot", "London");
        owner("Beatrix", "Pagerpot", "Near Sawrey");
        owner("Sherlock", "Holmespager", "London");

        OwnerPageDto page = list("?lastName=Pagerpot&size=5");

        assertThat(page.content()).extracting(OwnerDto::getFirstName).containsExactly("Beatrix", "Harry");
        assertThat(page.totalElements()).isEqualTo(2);
    }

    @Test
    void lastNameFilter_isCaseSensitive() throws Exception {
        owner("Harry", "Pagerpot", "London");

        OwnerPageDto page = list("?lastName=pagerpot");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isZero();
    }

    @Test
    void aPageLoadsPetsAndVisitsInBatches_notOneQueryPerOwner() throws Exception {
        entityManager.flush();
        entityManager.clear();
        Statistics statistics = entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();

        list("?size=20");

        // page + count + one batch of pets + one batch of visits (+ pet types)
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(5);
    }

    private Owner owner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return ownerRepository.save(owner);
    }

    private OwnerPageDto list(String query) throws Exception {
        String json = mockMvc.perform(get("/api/owners" + query))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readValue(json, OwnerPageDto.class);
    }

    private static List<Integer> idsOn(OwnerPageDto page) {
        return page.content().stream().map(OwnerDto::getId).toList();
    }
}
