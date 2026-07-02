package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;

/**
 * Server-side pagination and sorting of the Owners listing. The fixture inserts 12 owners
 * whose last names all share the unique prefix "Zpag" (so they sort after — and stay
 * isolated from — the Flyway seed data), each with a pet and a city assigned in reverse
 * order so a City sort differs from a Name sort.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerPaginationTest {

    static final String PREFIX = "Zpag";
    static final int TOTAL = 12;

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

    @BeforeEach
    void seed() {
        PetType cat = petTypeRepository.save(new PetType().setName("cat"));
        for (int i = 1; i <= TOTAL; i++) {
            Owner owner = new Owner()
                .setFirstName(String.format("First%02d", i))
                .setLastName(String.format("%s%02d", PREFIX, i))
                .setAddress("Addr " + i)
                .setCity(String.format("Zcity%02d", TOTAL + 1 - i)) // reverse of name order
                .setTelephone("1234567890");
            owner = ownerRepository.save(owner);

            Pet pet = new Pet();
            pet.setName("Pet" + i);
            pet.setBirthDate(LocalDate.now());
            pet.setType(cat);
            pet.setOwner(owner);
            petRepository.save(pet);
        }
        // reload from the DB on the next query instead of returning cached instances,
        // so pagination + @BatchSize pet loading are genuinely exercised
        entityManager.flush();
        entityManager.clear();
    }

    // --- repository: paging + filter + totalElements (task 2.1) ---

    @Test
    void repository_pagesTheFilteredResult() {
        Page<Owner> firstPage = ownerRepository.findByLastNameStartingWith(
            PREFIX, PageRequest.of(0, 5, Sort.by("lastName")));

        assertThat(firstPage.getTotalElements()).isEqualTo(TOTAL);
        assertThat(firstPage.getTotalPages()).isEqualTo(3);
        assertThat(firstPage.getContent())
            .extracting(Owner::getLastName)
            .containsExactly("Zpag01", "Zpag02", "Zpag03", "Zpag04", "Zpag05");

        Page<Owner> lastPage = ownerRepository.findByLastNameStartingWith(
            PREFIX, PageRequest.of(2, 5, Sort.by("lastName")));
        assertThat(lastPage.getContent())
            .extracting(Owner::getLastName)
            .containsExactly("Zpag11", "Zpag12");
        assertThat(lastPage.isLast()).isTrue();
    }

    // --- repository: sort by name/city, asc + desc (task 2.2) ---

    @Test
    void repository_sortsByNameAndCity() {
        Sort byNameDesc = Sort.by(Sort.Order.desc("lastName"), Sort.Order.desc("firstName"));
        assertThat(firstOf(byNameDesc).getLastName()).isEqualTo("Zpag12");

        assertThat(firstOf(Sort.by(Sort.Order.asc("city"))).getCity()).isEqualTo("Zcity01");
        assertThat(firstOf(Sort.by(Sort.Order.desc("city"))).getCity()).isEqualTo("Zcity12");
    }

    private Owner firstOf(Sort sort) {
        return ownerRepository.findByLastNameStartingWith(PREFIX, PageRequest.of(0, 5, sort))
            .getContent().get(0);
    }

    // --- pets load for the page without breaking the LIMIT (task 3.1) ---

    @Test
    void petsAreLoadedForThePageWithoutDefeatingPagination() {
        Page<Owner> page = ownerRepository.findByLastNameStartingWith(
            PREFIX, PageRequest.of(0, 5, Sort.by("lastName")));

        // the SQL LIMIT is honoured (5 of 12) even though every owner has a pets collection,
        // which a JOIN FETCH + Pageable would break by paginating in memory (HHH000104)
        assertThat(page.getContent()).hasSize(5);
        assertThat(page.getTotalElements()).isEqualTo(TOTAL);
        // and pets are still populated (loaded via @BatchSize, not lost)
        assertThat(page.getContent()).allSatisfy(o -> assertThat(o.getPets()).isNotEmpty());
    }

    // --- controller: paged JSON shape + default size (task 4.1) ---

    @Test
    void endpoint_returnsPagedModelShapeWithDefaultSize10() throws Exception {
        mockMvc.perform(get("/api/owners"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isArray())
            .andExpect(jsonPath("$.page.size").value(10))
            .andExpect(jsonPath("$.page.number").value(0))
            .andExpect(jsonPath("$.page.totalElements").isNumber())
            .andExpect(jsonPath("$.page.totalPages").isNumber());
    }

    // --- controller: size cap, sort fallback, filter composition (task 4.2) ---

    @Test
    void endpoint_clampsSizeToMax() throws Exception {
        mockMvc.perform(get("/api/owners?size=1000000"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page.size").value(100));
    }

    @Test
    void endpoint_ignoresUnsupportedSortAndFallsBackToNameAsc() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=" + PREFIX + "&size=100&sort=telephone,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].lastName").value("Zpag01"))
            .andExpect(jsonPath("$.content[11].lastName").value("Zpag12"));
    }

    @Test
    void endpoint_filterComposesWithPageAndSort() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=" + PREFIX + "&page=0&size=5&sort=name,desc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(5))
            .andExpect(jsonPath("$.content[0].lastName").value("Zpag12"))
            .andExpect(jsonPath("$.page.totalElements").value(TOTAL));
    }

    @Test
    void endpoint_sortsByCity() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=" + PREFIX + "&size=100&sort=city,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].city").value("Zcity01"));
    }
}
