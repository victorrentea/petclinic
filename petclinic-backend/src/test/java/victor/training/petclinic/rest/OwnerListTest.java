package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.jayway.jsonpath.JsonPath;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;

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
    @PersistenceContext
    EntityManager entityManager;

    @Test
    void firstPageOf10ByNameByDefault() throws Exception {
        saveOwners(27);

        list("/api/owners")
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.content[0].lastName").value("Owner01"))
                .andExpect(jsonPath("$.totalElements").value(27))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(10));
    }

    @Test
    void theLastPageHoldsTheRest() throws Exception {
        saveOwners(27);

        list("/api/owners?page=2&size=10")
                .andExpect(jsonPath("$.content.length()").value(7))
                .andExpect(jsonPath("$.content[0].lastName").value("Owner21"))
                .andExpect(jsonPath("$.number").value(2));
    }

    @Test
    void pagesOf20() throws Exception {
        saveOwners(27);

        list("/api/owners?size=20").andExpect(jsonPath("$.content.length()").value(20));
    }

    @Test
    void sameSurnameOrdersByFirstName() throws Exception {
        ownerRepository.save(owner("Wendy", "Darling", "London"));
        ownerRepository.save(owner("George", "Darling", "London"));

        list("/api/owners?sort=name,asc")
                .andExpect(jsonPath("$.content[*].firstName").value(contains("George", "Wendy")));
    }

    @Test
    void byCityReversed() throws Exception {
        ownerRepository.save(owner("Erwin", "Schroedinger", "Vienna"));
        ownerRepository.save(owner("Wallace", "Wensleydale", "Wigan"));

        list("/api/owners?sort=city,desc")
                .andExpect(jsonPath("$.content[*].city").value(contains("Wigan", "Vienna")));
    }

    @Test
    void searchingThenPaging() throws Exception {
        ownerRepository.save(owner("Harry", "Potter", "Little Whinging"));
        ownerRepository.save(owner("Beatrix", "Potter", "Near Sawrey"));
        ownerRepository.save(owner("Sherlock", "Holmes", "London"));

        list("/api/owners?lastName=Pot&size=5")
                .andExpect(jsonPath("$.content[*].firstName").value(contains("Beatrix", "Harry")))
                .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void identicalOwnersEachAppearOnExactlyOnePage() throws Exception {
        List<Integer> savedIds = IntStream.range(0, 15)
                .mapToObj(i -> ownerRepository.save(owner("Kevin", "McCallister", "Winnetka")).getId())
                .toList();

        List<Integer> listedIds = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            String json = list("/api/owners?sort=name,asc&size=5&page=" + page)
                    .andReturn().getResponse().getContentAsString();
            listedIds.addAll(JsonPath.read(json, "$.content[*].id"));
        }

        assertThat(listedIds).containsExactlyInAnyOrderElementsOf(savedIds);
    }

    @Test
    void aPageOfOwnersWithPetsTakesAFixedNumberOfQueries() throws Exception {
        PetType cat = petTypeRepository.findAll().get(0);
        for (int i = 0; i < 20; i++) {
            Owner owner = ownerRepository.save(owner("Ann", "Owner" + i, "London"));
            Pet pet = TestData.aPet();
            pet.setOwner(owner);
            pet.setType(cat);
            petRepository.save(pet);
        }
        entityManager.flush();
        entityManager.clear();
        Statistics statistics = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();

        list("/api/owners?size=20").andExpect(jsonPath("$.content[19].pets[0].name").value("Leo"));

        assertThat(statistics.getPrepareStatementCount())
                .as("page + count + pets + visits, not one query per owner")
                .isLessThanOrEqualTo(4);
    }

    @ParameterizedTest
    @ValueSource(strings = {"size=50000", "size=7", "size=0", "sort=telephone,asc", "sort=pets.name",
            "page=-1", "page=abc", "size=abc"})
    void anythingTheGridDoesNotOfferIsABadRequest(String query) throws Exception {
        mockMvc.perform(get("/api/owners?" + query))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation Error"))
                .andExpect(jsonPath("$.detail").value(containsString(query.substring(0, query.indexOf('=')))));
    }

    private ResultActions list(String uri) throws Exception {
        return mockMvc.perform(get(uri)).andExpect(status().isOk());
    }

    private void saveOwners(int count) {
        for (int i = count; i >= 1; i--) { // saved in reverse, so id order can't pass for name order
            ownerRepository.save(owner("Ann", "Owner%02d".formatted(i), "London"));
        }
    }

    private static Owner owner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        return owner;
    }
}
