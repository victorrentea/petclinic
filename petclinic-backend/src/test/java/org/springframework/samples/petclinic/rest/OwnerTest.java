package org.springframework.samples.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.samples.petclinic.repository.PetRepository;
import org.springframework.samples.petclinic.repository.PetTypeRepository;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.samples.petclinic.rest.dto.PetDto;
import org.springframework.samples.petclinic.rest.dto.PetTypeDto;
import org.springframework.security.test.context.support.WithMockUser;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerTest extends OwnerTestBase {

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    int ownerId;
    int petId;
    PetType petType;

    @BeforeEach
    final void before() {
        Owner owner = TestData.anOwner()
            .setFirstName("George")
            .setLastName("Franklin");
        owner = ownerRepository.save(owner);
        ownerId = owner.getId();

        petType = petTypeRepository.save(new PetType().setName("dog"));

        Pet pet = new Pet()
            .setName("Rosy")
            .setBirthDate(LocalDate.now())
            .setOwner(owner)
            .setType(petType);
        pet = petRepository.save(pet);
        petId = pet.getId();

        // Add pet to owner's collection for bidirectional relationship
        owner.addPet(pet);
    }


    @Test
    void getByIdOk() throws Exception {
        OwnerDto responseDto = callGet(ownerId);

        assertThat(responseDto.getId()).isEqualTo(ownerId);
        assertThat(responseDto.getFirstName()).isEqualTo("George");
        assertThat(responseDto.getLastName()).isEqualTo("Franklin");
    }

    @Test
    void getById_notFound() throws Exception {
        mockMvc.perform(get("/api/owners/99999"))
            .andExpect(status().isNotFound());
    }

    @Test
    void getAll() throws Exception {
        List<OwnerDto> owners = search("/api/owners");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getFirstName, OwnerDto::getLastName)
            .contains(Assertions.tuple(ownerId, "George", "Franklin"));
    }

    @Test
    void getAllWithTextFilter_onLastName() throws Exception {
        // Create another owner with a different last name
        Owner owner2 = TestData.anOwner()
            .setFirstName("Betty")
            .setLastName("Davis");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerDto> owners = search("/api/owners?q=Dav");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getLastName)
            .contains(Assertions.tuple(owner2Id, "Davis"))
            .doesNotContain(Assertions.tuple(ownerId, "Franklin"));
    }

    @Test
    void getAllWithTextFilter_onLastNameSecondCase() throws Exception {
        Owner owner2 = TestData.anOwner()
            .setLastName("JavaBeans");
        int owner2Id = ownerRepository.save(owner2).getId();

        List<OwnerDto> owners = search("/api/owners?q=Java");

        assertThat(owners)
            .extracting(OwnerDto::getId, OwnerDto::getLastName)
            .contains(Assertions.tuple(owner2Id, "JavaBeans"));
    }

    @Test
    void getAllWithTextFilter() throws Exception {
        Owner owner2 = TestData.anOwner()
            .setFirstName("Betty")
            .setLastName("Davis")
            .setAddress("22 Main st")
            .setCity("Seattle")
            .setTelephone("1234567890");
        owner2 = ownerRepository.save(owner2);

        List<OwnerDto> byAddress = search("/api/owners?q=Main");
        List<OwnerDto> byCity = search("/api/owners?q=Seattle");

        assertThat(byAddress)
            .extracting(OwnerDto::getId)
            .contains(owner2.getId());
        assertThat(byCity)
            .extracting(OwnerDto::getId)
            .contains(owner2.getId());
    }

    @Test
    void getAllWithTextFilter_caseInsensitive() throws Exception {
        Owner owner2 = TestData.anOwner()
            .setAddress("22 Main st");
        owner2 = ownerRepository.save(owner2);

        List<OwnerDto> matchingCase = search("/api/owners?q=Main");
        List<OwnerDto> differentCase = search("/api/owners?q=main");

        assertThat(matchingCase)
            .extracting(OwnerDto::getId)
            .contains(owner2.getId());
        assertThat(differentCase)
            .extracting(OwnerDto::getId)
            .contains(owner2.getId());
    }

    @Test
    void getAllWithEmptyTextFilter_returnsAllOwners() throws Exception {
        Owner owner2 = TestData.anOwner()
            .setFirstName("Betty")
            .setLastName("Davis");
        owner2 = ownerRepository.save(owner2);

        List<OwnerDto> owners = search("/api/owners?q=");

        assertThat(owners)
            .extracting(OwnerDto::getId)
            .contains(ownerId, owner2.getId());
    }


    @Test
    void getAllWithTextFilter_notFound() throws Exception {
        List<OwnerDto> results = search("/api/owners?q=NonExistent");

        assertThat(results).isEmpty();
    }

    @Test
    void create_ok() throws Exception {
        OwnerDto newOwner = new OwnerDto()
            .setFirstName("Eduardo")
            .setLastName("Rodriquez")
            .setAddress("2693 Commerce St.")
            .setCity("McFarland")
            .setTelephone("6085558763");

        mockMvc.perform(post("/api/owners")
                .content(mapper.writeValueAsString(newOwner))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void create_invalid() throws Exception {
        OwnerDto newOwner = new OwnerDto()
            // missing firstName - validation error
            .setLastName("Rodriquez")
            .setAddress("2693 Commerce St.")
            .setCity("McFarland")
            .setTelephone("6085558763");

        mockMvc.perform(post("/api/owners")
                .content(mapper.writeValueAsString(newOwner))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isBadRequest());
    }

    @Test
    void update_ok() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setFirstName("GeorgeI");

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());

        // assert the update took place
        OwnerDto updated = callGet(ownerId);
        assertThat(updated.getFirstName()).isEqualTo("GeorgeI");
    }

    @Test
    void update_okNoBodyId() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setId(null); // Test without body ID
        existing.setFirstName("GeorgeII");

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());

        // assert the update took place
        OwnerDto updated = callGet(ownerId);
        assertThat(updated.getFirstName()).isEqualTo("GeorgeII");
    }

    @Test
    void update_invalid() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setFirstName(""); // invalid firstName

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void delete_ok() throws Exception {
        mockMvc.perform(delete("/api/owners/" + ownerId))
            .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/owners/" + ownerId))
            .andExpect(status().isNotFound());
    }

    @Test
    void delete_notFound() throws Exception {
        mockMvc.perform(delete("/api/owners/9999"))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void createPet_ok() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
            .setId(petType.getId())
            .setName(petType.getName());
        PetDto newPet = new PetDto()
            .setName("Max")
            .setBirthDate(LocalDate.now())
            .setType(typeDto);

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
                .content(mapper.writeValueAsString(newPet))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void createPet_invalid() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
            .setId(petType.getId())
            .setName(petType.getName());
        PetDto newPet = new PetDto()
            // missing name - validation error
            .setBirthDate(LocalDate.now())
            .setType(typeDto);

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
                .content(mapper.writeValueAsString(newPet))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isBadRequest());
    }

    @Test
    void getOwnerPet_ok() throws Exception {
        mockMvc.perform(get("/api/owners/" + ownerId + "/pets/" + petId))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andExpect(jsonPath("$.id").value(petId))
            .andExpect(jsonPath("$.name").value("Rosy"));
    }

    @Test
    void getOwnerPet_ownerNotFound() throws Exception {
        mockMvc.perform(get("/api/owners/99999/pets/" + petId))
            .andExpect(status().isNotFound());
    }

    @Test
    void getOwnerPet_petNotFound() throws Exception {
        mockMvc.perform(get("/api/owners/" + ownerId + "/pets/99999"))
            .andExpect(status().isNotFound());
    }

    @Test
    void updateOwnerPet_ok() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
            .setId(petType.getId())
            .setName(petType.getName());
        PetDto petDto = new PetDto()
            .setId(petId)
            .setName("Rosy Updated")
            .setBirthDate(LocalDate.of(2020, 1, 15))
            .setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_ownerNotFound() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
            .setId(petType.getId())
            .setName(petType.getName());
        PetDto petDto = new PetDto()
            .setName("Thor")
            .setBirthDate(LocalDate.now())
            .setType(typeDto);

        mockMvc.perform(put("/api/owners/99999/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_petNotFound() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
            .setId(petType.getId())
            .setName(petType.getName());
        PetDto petDto = new PetDto()
            .setName("Ghost")
            .setBirthDate(LocalDate.of(2020, 1, 1))
            .setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/99999")
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isNotFound());
    }

    @Test
    void getOwner_includesPetsWithType() throws Exception {
        // Verifies that owner response includes pets with their type name loaded (lazy-loading works)
        OwnerDto responseDto = callGet(ownerId);

        assertThat(responseDto.getPets()).hasSize(1);
        assertThat(responseDto.getPets().get(0).getName()).isEqualTo("Rosy");
        assertThat(responseDto.getPets().get(0).getType()).isNotNull();
        assertThat(responseDto.getPets().get(0).getType().getName()).isEqualTo("dog");
    }

    // --- Pagination & Sorting (tasks 4.1–4.4) ---

    @Test
    void listOwners_paginationStructureReturned() throws Exception {
        OwnerPageResult page = searchPage("/api/owners?page=0&size=5");

        assertThat(page.content).isNotNull();
        assertThat(page.number).isEqualTo(0);
        assertThat(page.size).isEqualTo(5);
        assertThat(page.totalElements).isGreaterThanOrEqualTo(1);
        assertThat(page.totalPages).isGreaterThanOrEqualTo(1);
    }

    @Test
    void listOwners_sortByFirstNameAsc() throws Exception {
        ownerRepository.save(TestData.anOwner().setFirstName("Zelda"));
        ownerRepository.save(TestData.anOwner().setFirstName("Aaron"));

        OwnerPageResult page = searchPage("/api/owners?sort=firstName,asc&size=100");

        List<String> firstNames = page.content.stream().map(OwnerDto::getFirstName).toList();
        assertThat(firstNames).isSortedAccordingTo(String.CASE_INSENSITIVE_ORDER);
    }

    @Test
    void listOwners_invalidSortField_returns400() throws Exception {
        mockMvc.perform(get("/api/owners?sort=telephone,asc"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void listOwners_oversizedPage_isCappedAtMax() throws Exception {
        OwnerPageResult page = searchPage("/api/owners?size=999999");

        assertThat(page.size).isLessThanOrEqualTo(500);
    }

    @Test
    void listOwners_searchWithPagination_totalElementsMatchesFilter() throws Exception {
        Owner s1 = TestData.anOwner().setLastName("XyzSmithPaginTest"); ownerRepository.save(s1);
        Owner s2 = TestData.anOwner().setLastName("XyzSmithPaginTest2"); ownerRepository.save(s2);
        Owner other = TestData.anOwner().setLastName("XyzJonesPaginTest"); ownerRepository.save(other);

        OwnerPageResult page = searchPage("/api/owners?q=XyzSmithPaginTest&page=0&size=10");

        assertThat(page.totalElements).isEqualTo(2);
        assertThat(page.content).hasSize(2);
    }
}
