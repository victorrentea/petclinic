package victor.training.petclinic.rest;

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

import org.assertj.core.api.Assertions;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetTypeDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
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

    @Autowired
    EntityManagerFactory entityManagerFactory;

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

        // Add pet to owner's collection for bidirectional relationship
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
    void count_returnsOwnerCount() throws Exception {
        long before = ownerRepository.count();

        mockMvc.perform(get("/api/owners/count"))
                .andExpect(status().isOk())
                .andExpect(content().string(String.valueOf(before)));
    }

    @Test
    void getAll() throws Exception {
        OwnerPageDto page = search("/api/owners?size=20");

        assertThat(page.getContent())
                .extracting(OwnerDto::getId, OwnerDto::getFirstName, OwnerDto::getLastName)
                .contains(Assertions.tuple(ownerId, "George", "Franklin"));
    }

    @Test
    void getAllWithAddressFilter() throws Exception {
        Owner owner2 = TestData.anOwner();
        owner2.setLastName("JavaBeans");
        int owner2Id = ownerRepository.save(owner2).getId();

        OwnerPageDto page = search("/api/owners?lastName=Java");

        assertThat(page.getContent())
                .extracting(OwnerDto::getId, OwnerDto::getLastName)
                .contains(Assertions.tuple(owner2Id, "JavaBeans"));
    }

    private OwnerPageDto search(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        return mapper.readValue(responseJson, OwnerPageDto.class);
    }

    @Test
    void getAllWithNameFilter_notFound() throws Exception {
        OwnerPageDto page = search("/api/owners?lastName=NonExistent");

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isZero();
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
    void createPet_invalid() throws Exception {
        PetTypeDto typeDto = new PetTypeDto()
                .setId(petType.getId())
                .setName(petType.getName());
        // missing name - validation error
        PetDto newPet = new PetDto()
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
    void defaultRequest_returnsFirstPageByNameAscWithTotal() throws Exception {
        OwnerPageDto page = search("/api/owners");

        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getTotalElements()).isEqualTo(ownerRepository.count());
        List<String> firstNames = page.getContent().stream().map(OwnerDto::getFirstName).toList();
        assertThat(firstNames).isSorted();
    }

    @Test
    void sortByCityDesc_ordersDescending() throws Exception {
        OwnerPageDto page = search("/api/owners?sort=city&dir=desc&size=20");

        List<String> cities = page.getContent().stream().map(OwnerDto::getCity).toList();
        assertThat(cities).isSortedAccordingTo(Comparator.reverseOrder());
    }

    @Test
    void pageAndSize_pagesAreDisjointAndContinueOrder() throws Exception {
        OwnerPageDto combined = search("/api/owners?size=10");
        OwnerPageDto page0 = search("/api/owners?size=5&page=0");
        OwnerPageDto page1 = search("/api/owners?size=5&page=1");

        assertThat(page0.getContent()).hasSize(5);
        assertThat(page1.getContent()).hasSize(5);
        List<Integer> pagedIds = concatIds(page0, page1);
        List<Integer> combinedIds = combined.getContent().stream().map(OwnerDto::getId).toList();
        assertThat(pagedIds).isEqualTo(combinedIds);
    }

    private List<Integer> concatIds(OwnerPageDto page0, OwnerPageDto page1) {
        List<Integer> ids = new ArrayList<>(page0.getContent().stream().map(OwnerDto::getId).toList());
        page1.getContent().forEach(o -> ids.add(o.getId()));
        return ids;
    }

    @Test
    void pagePastTheEnd_returnsEmptyContentWithRealTotal() throws Exception {
        OwnerPageDto page = search("/api/owners?page=999&size=20");

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isEqualTo(ownerRepository.count());
    }

    @Test
    void lastNameFilter_countsOnlyMatches() throws Exception {
        Owner filtered1 = TestData.anOwner();
        filtered1.setLastName("ZzGridFilterOne");
        ownerRepository.save(filtered1);
        Owner filtered2 = TestData.anOwner();
        filtered2.setLastName("ZzGridFilterTwo");
        ownerRepository.save(filtered2);

        OwnerPageDto page = search("/api/owners?lastName=ZzGridFilter");

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).hasSize(2);
    }

    @Test
    void invalidSize_returns400ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/owners?size=1000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void invalidSort_returns400ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/owners?sort=telephone"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void invalidDir_returns400ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/owners?dir=up"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void ownerSort_name_hasFirstNameLastNameIdTieBreakers() {
        Sort sort = OwnerRestController.OwnerSort.NAME.sort(Sort.Direction.ASC);

        assertThat(sort.stream().map(Sort.Order::getProperty))
                .containsExactly("firstName", "lastName", "id");
        assertThat(sort).allMatch(Sort.Order::isAscending);
    }

    @Test
    void ownerSort_city_hasCityFirstNameLastNameIdTieBreakers() {
        Sort sort = OwnerRestController.OwnerSort.CITY.sort(Sort.Direction.DESC);

        assertThat(sort.stream().map(Sort.Order::getProperty))
                .containsExactly("city", "firstName", "lastName", "id");
        assertThat(sort).allMatch(Sort.Order::isDescending);
    }

    // Budget: page select + count select + one batched IN(...) for the page's pets, all
    // capped by @BatchSize(20) regardless of page size (5/10/20). A 4th statement batches the
    // visits nested under those pets (OwnerMapper walks pet.getVisitsSortedByDate() building the
    // response tree) — also @BatchSize(20) on Pet.visits, otherwise it would be one query per pet.
    @Test
    void listOwners_costsAtMostFourQueries() throws Exception {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();

        mockMvc.perform(get("/api/owners")).andExpect(status().isOk());

        assertThat(stats.getPrepareStatementCount()).isLessThanOrEqualTo(4);
    }

}
