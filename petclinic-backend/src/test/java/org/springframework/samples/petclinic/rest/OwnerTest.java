package org.springframework.samples.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

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
import org.springframework.samples.petclinic.rest.dto.PagedOwnersDto;
import org.springframework.samples.petclinic.rest.dto.PetDto;
import org.springframework.samples.petclinic.rest.dto.PetTypeDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerTest {

    @Autowired
    MockMvc mockMvc;

    ObjectMapper mapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .setDateFormat(new SimpleDateFormat("yyyy-MM-dd"))
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

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
        Owner owner = TestData.anOwner();
        owner.setFirstName("George");
        owner.setLastName("Franklin");
        owner = ownerRepository.save(owner);
        ownerId = owner.getId();

        petType = new PetType();
        petType.setName("dog");
        petType = petTypeRepository.save(petType);

        Pet pet = new Pet();
        pet.setName("Rosy");
        pet.setBirthDate(LocalDate.now());
        pet.setOwner(owner);
        pet.setType(petType);
        pet = petRepository.save(pet);
        petId = pet.getId();

        owner.addPet(pet);
    }

    private OwnerDto callGet(int ownerId) throws Exception {
        String responseJson = mockMvc.perform(get("/api/owners/" + ownerId))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return mapper.readValue(responseJson, OwnerDto.class);
    }

    /** Calls GET /api/owners with the given URI and returns the PagedOwnersDto. */
    private PagedOwnersDto searchPaged(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return mapper.readValue(responseJson, PagedOwnersDto.class);
    }

    // -------------------------------------------------------------------------
    // Existing tests — updated to use PagedOwnersDto (task 4.1)
    // -------------------------------------------------------------------------

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
        PagedOwnersDto result = searchPaged("/api/owners");

        assertThat(result.owners())
            .extracting(OwnerDto::getId, OwnerDto::getFirstName, OwnerDto::getLastName)
            .contains(Assertions.tuple(ownerId, "George", "Franklin"));
    }

    @Test
    void getAllWithNameFilter() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setFirstName("Betty");
        owner2.setLastName("Davis");
        int owner2Id = ownerRepository.save(owner2).getId();

        PagedOwnersDto result = searchPaged("/api/owners?lastName=Dav");

        assertThat(result.owners())
            .extracting(OwnerDto::getId, OwnerDto::getLastName)
            .contains(Assertions.tuple(owner2Id, "Davis"))
            .doesNotContain(Assertions.tuple(ownerId, "Franklin"));
    }

    @Test
    void getAllWithAddressFilter() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("JavaBeans");
        int owner2Id = ownerRepository.save(owner2).getId();

        PagedOwnersDto result = searchPaged("/api/owners?lastName=Java");

        assertThat(result.owners())
            .extracting(OwnerDto::getId, OwnerDto::getLastName)
            .contains(Assertions.tuple(owner2Id, "JavaBeans"));
    }

    @Test
    void getAllWithUnifiedSearchAcrossOwnerAndPetFields() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setFirstName("Alice");
        owner2.setLastName("Popescu");
        owner2.setAddress("Bulevardul Unirii 9");
        owner2.setCity("Cluj");
        owner2.setTelephone("0712345678");
        owner2 = ownerRepository.save(owner2);

        Pet pet = new Pet();
        pet.setName("Rex");
        pet.setBirthDate(LocalDate.now());
        pet.setOwner(owner2);
        pet.setType(petType);
        petRepository.save(pet);
        owner2.addPet(pet);

        PagedOwnersDto byAddress   = searchPaged("/api/owners?lastName=Unir");
        PagedOwnersDto byCity      = searchPaged("/api/owners?lastName=clu");
        PagedOwnersDto byTelephone = searchPaged("/api/owners?lastName=1234");
        PagedOwnersDto byPetName   = searchPaged("/api/owners?lastName=ex");

        assertThat(byAddress.owners()).extracting(OwnerDto::getId).contains(owner2.getId());
        assertThat(byCity.owners()).extracting(OwnerDto::getId).contains(owner2.getId());
        assertThat(byTelephone.owners()).extracting(OwnerDto::getId).contains(owner2.getId());
        assertThat(byPetName.owners()).extracting(OwnerDto::getId).contains(owner2.getId());
    }

    @Test
    void getAllWithUnifiedSearch_isCaseInsensitiveAndMatchesInsideWords() throws Exception {
        PagedOwnersDto result = searchPaged("/api/owners?lastName=ANKL");

        assertThat(result.owners())
            .extracting(OwnerDto::getId, OwnerDto::getLastName)
            .contains(Assertions.tuple(ownerId, "Franklin"));
    }

    @Test
    void getAllWithUnifiedSearch_isRomanianDiacriticInsensitive() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setFirstName("Ioan");
        owner2.setLastName("\u0218erban");
        owner2.setAddress("Strada Lalelelor");
        owner2.setCity("Bra\u0219ov");
        owner2.setTelephone("0700000001");
        int owner2Id = ownerRepository.save(owner2).getId();

        PagedOwnersDto byAsciiS    = searchPaged("/api/owners?lastName=serb");
        PagedOwnersDto byAsciiCity = searchPaged("/api/owners?lastName=bras");

        assertThat(byAsciiS.owners()).extracting(OwnerDto::getId).contains(owner2Id);
        assertThat(byAsciiCity.owners()).extracting(OwnerDto::getId).contains(owner2Id);
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        PagedOwnersDto result = searchPaged("/api/owners?lastName=NonExistent");
        assertThat(result.owners()).isEmpty();
    }

    // -------------------------------------------------------------------------
    // CRUD tests (unchanged logic, kept for completeness)
    // -------------------------------------------------------------------------

    @Test
    void create_ok() throws Exception {
        OwnerDto newOwner = new OwnerDto();
        newOwner.setFirstName("Eduardo");
        newOwner.setLastName("Rodriquez");
        newOwner.setAddress("2693 Commerce St.");
        newOwner.setCity("McFarland");
        newOwner.setTelephone("6085558763");

        mockMvc.perform(post("/api/owners")
                .content(mapper.writeValueAsString(newOwner))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void create_invalid() throws Exception {
        OwnerDto newOwner = new OwnerDto();
        newOwner.setLastName("Rodriquez");
        newOwner.setAddress("2693 Commerce St.");
        newOwner.setCity("McFarland");
        newOwner.setTelephone("6085558763");

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

        OwnerDto updated = callGet(ownerId);
        assertThat(updated.getFirstName()).isEqualTo("GeorgeI");
    }

    @Test
    void update_okNoBodyId() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setId(null);
        existing.setFirstName("GeorgeII");

        mockMvc.perform(put("/api/owners/" + ownerId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());

        OwnerDto updated = callGet(ownerId);
        assertThat(updated.getFirstName()).isEqualTo("GeorgeII");
    }

    @Test
    void update_invalid() throws Exception {
        OwnerDto existing = callGet(ownerId);
        existing.setFirstName("");

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
        PetDto newPet = new PetDto();
        newPet.setName("Max");
        newPet.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        newPet.setType(typeDto);

        mockMvc.perform(post("/api/owners/" + ownerId + "/pets")
                .content(mapper.writeValueAsString(newPet))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void createPet_invalid() throws Exception {
        PetDto newPet = new PetDto();
        newPet.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        newPet.setType(typeDto);

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
        PetDto petDto = new PetDto();
        petDto.setId(petId);
        petDto.setName("Rosy Updated");
        petDto.setBirthDate(LocalDate.of(2020, 1, 15));
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        petDto.setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_ownerNotFound() throws Exception {
        PetDto petDto = new PetDto();
        petDto.setName("Thor");
        petDto.setBirthDate(LocalDate.now());
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        petDto.setType(typeDto);

        mockMvc.perform(put("/api/owners/99999/pets/" + petId)
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void updateOwnerPet_petNotFound() throws Exception {
        PetDto petDto = new PetDto();
        petDto.setName("Ghost");
        petDto.setBirthDate(LocalDate.of(2020, 1, 1));
        PetTypeDto typeDto = new PetTypeDto();
        typeDto.setId(petType.getId());
        typeDto.setName(petType.getName());
        petDto.setType(typeDto);

        mockMvc.perform(put("/api/owners/" + ownerId + "/pets/99999")
                .content(mapper.writeValueAsString(petDto))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isNotFound());
    }

    @Test
    void getOwner_includesPetsWithType() throws Exception {
        OwnerDto responseDto = callGet(ownerId);

        assertThat(responseDto.getPets()).hasSize(1);
        assertThat(responseDto.getPets().get(0).getName()).isEqualTo("Rosy");
        assertThat(responseDto.getPets().get(0).getType()).isNotNull();
        assertThat(responseDto.getPets().get(0).getType().getName()).isEqualTo("dog");
    }

    // -------------------------------------------------------------------------
    // Pagination-specific tests (tasks 4.2 – 4.9)
    // -------------------------------------------------------------------------

    /** Task 4.2 — no params → currentPage=0, owners.size ≤ 10, totalElements ≥ 1 */
    @Test
    void listOwners_defaultPagination() throws Exception {
        PagedOwnersDto result = searchPaged("/api/owners");

        assertThat(result.currentPage()).isEqualTo(0);
        assertThat(result.owners()).hasSizeLessThanOrEqualTo(10);
        assertThat(result.totalElements()).isGreaterThanOrEqualTo(1);
    }

    /** Task 4.3 — seed 3+ owners, page=1&size=2 → correct second slice, totalPages=ceil(n/2) */
    @Test
    void listOwners_secondPage() throws Exception {
        // Seed two extra owners so we have at least 3 total (before() already saved one)
        Owner o2 = TestData.anOwner();
        o2.setFirstName("Alice");
        o2.setLastName("Brown");
        ownerRepository.save(o2);

        Owner o3 = TestData.anOwner();
        o3.setFirstName("Zara");
        o3.setLastName("Adams");
        ownerRepository.save(o3);

        // Fetch page 0 to learn the total
        PagedOwnersDto page0 = searchPaged("/api/owners?page=0&size=2");
        long total = page0.totalElements();
        int expectedTotalPages = (int) Math.ceil((double) total / 2);

        PagedOwnersDto page1 = searchPaged("/api/owners?page=1&size=2");

        assertThat(page1.currentPage()).isEqualTo(1);
        assertThat(page1.totalPages()).isEqualTo(expectedTotalPages);
        // Second page must not overlap with first page
        List<Integer> page0Ids = page0.owners().stream().map(OwnerDto::getId).collect(Collectors.toList());
        List<Integer> page1Ids = page1.owners().stream().map(OwnerDto::getId).collect(Collectors.toList());
        assertThat(page1Ids).doesNotContainAnyElementsOf(page0Ids);
    }

    /** Task 4.4 — page=999 → owners empty, totalElements correct */
    @Test
    void listOwners_outOfRange() throws Exception {
        PagedOwnersDto all    = searchPaged("/api/owners");
        PagedOwnersDto result = searchPaged("/api/owners?page=999");

        assertThat(result.owners()).isEmpty();
        assertThat(result.totalElements()).isEqualTo(all.totalElements());
    }

    /** Task 4.5 — size=0 → 400 */
    @Test
    void listOwners_invalidSize_tooSmall() throws Exception {
        mockMvc.perform(get("/api/owners?size=0"))
            .andExpect(status().isBadRequest());
    }

    /** Task 4.6 — size=101 → 400 */
    @Test
    void listOwners_invalidSize_tooLarge() throws Exception {
        mockMvc.perform(get("/api/owners?size=101"))
            .andExpect(status().isBadRequest());
    }

    /** Task 4.7 — page=-1 → 400 */
    @Test
    void listOwners_invalidPage_negative() throws Exception {
        mockMvc.perform(get("/api/owners?page=-1"))
            .andExpect(status().isBadRequest());
    }

    /** Task 4.8 — lastName=Fr&page=0&size=5 → only matching owners, totalElements reflects filter */
    @Test
    void listOwners_filteredPagination() throws Exception {
        // before() already saved "George Franklin" — matches "Fr" in lastName.
        // Add an owner that definitely does NOT match "Fr" in any field.
        Owner nonMatch = TestData.anOwner();
        nonMatch.setFirstName("Betty");
        nonMatch.setLastName("Zzzz");
        nonMatch.setAddress("1 Nowhere Lane");
        nonMatch.setCity("Nowhere");
        nonMatch.setTelephone("0000000000");
        ownerRepository.save(nonMatch);

        PagedOwnersDto filtered = searchPaged("/api/owners?lastName=Fr&page=0&size=5");
        PagedOwnersDto all      = searchPaged("/api/owners?page=0&size=100");

        assertThat(filtered.owners()).isNotEmpty();
        // totalElements for the filtered result must be less than the total (nonMatch is excluded)
        assertThat(filtered.totalElements()).isLessThan(all.totalElements());
        // The non-matching owner must not appear in the filtered results
        List<Integer> filteredIds = filtered.owners().stream().map(OwnerDto::getId).collect(Collectors.toList());
        assertThat(filteredIds).doesNotContain(nonMatch.getId());
    }

    /** Task 4.9 — seed owners with known names, assert sorted ascending by firstName + " " + lastName */
    @Test
    void listOwners_sortedOrder() throws Exception {
        // Clear slate: before() saved "George Franklin". Add more with known sort order.
        Owner o1 = TestData.anOwner();
        o1.setFirstName("Zara");
        o1.setLastName("Adams");
        ownerRepository.save(o1);

        Owner o2 = TestData.anOwner();
        o2.setFirstName("Alice");
        o2.setLastName("Brown");
        ownerRepository.save(o2);

        Owner o3 = TestData.anOwner();
        o3.setFirstName("Mike");
        o3.setLastName("Adams");
        ownerRepository.save(o3);

        // Fetch all on a single large page
        PagedOwnersDto result = searchPaged("/api/owners?page=0&size=100");

        List<String> fullNames = result.owners().stream()
            .map(o -> o.getFirstName() + " " + o.getLastName())
            .collect(Collectors.toList());

        List<String> sorted = new ArrayList<>(fullNames);
        sorted.sort(Comparator.naturalOrder());

        assertThat(fullNames).isEqualTo(sorted);
    }

}
