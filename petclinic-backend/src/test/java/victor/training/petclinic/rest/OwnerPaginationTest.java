package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.transaction.Transactional;

import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;
import victor.training.petclinic.rest.dto.OwnerPageDto;

/**
 * Covers the paging/sorting behavior of {@code GET /api/owners} added for Issue #25 — see
 * {@code openspec/changes/add-owners-pagination}.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerPaginationTest {

    /** Unlikely to collide with the seeded sample data, so every scenario is self-contained. */
    private static final String PREFIX = "Zzpage";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    @Autowired
    VisitRepository visitRepository;

    ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .setDateFormat(new SimpleDateFormat("yyyy-MM-dd"))
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private OwnerPageDto callGet(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return mapper.readValue(responseJson, OwnerPageDto.class);
    }

    private Owner ownerNamed(String lastName, String firstName) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        owner.setFirstName(firstName);
        return ownerRepository.save(owner);
    }

    @Test
    void defaultPage_hasSizeTenAndPageZero() throws Exception {
        for (int i = 0; i < 12; i++) {
            ownerNamed(PREFIX + "Default", "F" + i);
        }

        OwnerPageDto page = callGet("/api/owners?lastName=" + PREFIX + "Default");

        assertThat(page.getNumber()).isEqualTo(0);
        assertThat(page.getSize()).isEqualTo(10);
        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getTotalElements()).isEqualTo(12);
    }

    @Test
    void explicitPageAndSize_returnTheRequestedSlice() throws Exception {
        for (int i = 0; i < 25; i++) {
            ownerNamed(PREFIX + "Explicit", "F" + i);
        }

        OwnerPageDto page = callGet("/api/owners?lastName=" + PREFIX + "Explicit&page=1&size=10");

        assertThat(page.getNumber()).isEqualTo(1);
        assertThat(page.getSize()).isEqualTo(10);
        assertThat(page.getContent()).hasSize(10);
    }

    @Test
    void pageBeyondAvailableData_returnsEmptyContentWith200() throws Exception {
        ownerNamed(PREFIX + "Single", "Only");

        OwnerPageDto page = callGet("/api/owners?lastName=" + PREFIX + "Single&page=5&size=10");

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isEqualTo(1);
    }

    @Test
    void searchComposesWithPaging() throws Exception {
        ownerNamed(PREFIX + "Davis", "One");
        ownerNamed(PREFIX + "Davis", "Two");
        ownerNamed(PREFIX + "Other", "Three");

        OwnerPageDto page = callGet("/api/owners?lastName=" + PREFIX + "Davis&page=0&size=5");

        assertThat(page.getContent()).extracting("lastName").containsOnly(PREFIX + "Davis");
        assertThat(page.getTotalElements()).isEqualTo(2);
    }

    @Test
    void sortByAllowedColumn_city_succeeds() throws Exception {
        mockMvc.perform(get("/api/owners?sort=city,asc")).andExpect(status().isOk());
    }

    @Test
    void sortByAllowedColumn_lastName_succeeds() throws Exception {
        mockMvc.perform(get("/api/owners?sort=lastName,desc")).andExpect(status().isOk());
    }

    @Test
    void sortByDisallowedColumn_telephone_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=telephone,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void sortByNestedProperty_petsName_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=pets.name,asc")).andExpect(status().isBadRequest());
    }

    @Test
    void sortByCity_ordersDiacriticsByBaseLetterNotAfterAscii() throws Exception {
        Owner owner1 = ownerNamed(PREFIX + "Diacritic", "A");
        owner1.setCity("Adamowo");
        ownerRepository.save(owner1);
        Owner owner2 = ownerNamed(PREFIX + "Diacritic", "B");
        owner2.setCity("\u015aliwice"); // "Śliwice" - should sort with the S's, not after Z
        ownerRepository.save(owner2);
        Owner owner3 = ownerNamed(PREFIX + "Diacritic", "C");
        owner3.setCity("Zabrze");
        ownerRepository.save(owner3);

        OwnerPageDto page = callGet("/api/owners?lastName=" + PREFIX + "Diacritic&sort=city,asc");

        assertThat(page.getContent()).extracting("city")
                .containsExactly("Adamowo", "\u015aliwice", "Zabrze");
    }

    @Test
    void stableTieBreaker_noOwnerDuplicatedOrSkippedAcrossPages() throws Exception {
        Set<Integer> createdIds = new HashSet<>();
        for (int i = 0; i < 13; i++) {
            createdIds.add(ownerNamed(PREFIX + "Tie", "SameFirst").getId());
        }

        List<Integer> seenIds = new ArrayList<>();
        int page = 0;
        while (true) {
            OwnerPageDto pageDto = callGet("/api/owners?lastName=" + PREFIX + "Tie&sort=lastName,asc&page=" + page
                    + "&size=5");
            if (pageDto.getContent().isEmpty()) {
                break;
            }
            pageDto.getContent().forEach(o -> seenIds.add(o.getId()));
            page++;
        }

        assertThat(seenIds).hasSize(createdIds.size());
        assertThat(new HashSet<>(seenIds)).isEqualTo(createdIds);
    }

    @Test
    void listPayload_omitsPetVisitsAndType_butKeepsPetNames() throws Exception {
        Owner owner = ownerNamed(PREFIX + "Slim", "Owner");
        PetType dog = new PetType();
        dog.setName(PREFIX + "dog");
        dog = petTypeRepository.save(dog);
        Pet pet = new Pet();
        pet.setName(PREFIX + "Rex");
        pet.setBirthDate(java.time.LocalDate.now());
        pet.setType(dog);
        owner.addPet(pet);
        owner = ownerRepository.save(owner);
        Visit visit = new Visit();
        visit.setDate(java.time.LocalDate.now());
        visit.setDescription("checkup");
        visit.setPet(owner.getPets().get(0));
        visitRepository.save(visit);

        String responseJson = mockMvc.perform(get("/api/owners?lastName=" + PREFIX + "Slim"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(responseJson).contains(PREFIX + "Rex");
        assertThat(responseJson).doesNotContain("checkup").doesNotContain(PREFIX + "dog");
    }
}
