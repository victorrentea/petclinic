package victor.training.petclinic.rest;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// #40: a visit is dated between the pet's birth and one year from today.
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class VisitDateRangeTest {
    static final LocalDate BIRTH_DATE = LocalDate.of(2024, 5, 10);
    static final LocalDate ONE_YEAR_FROM_TODAY = LocalDate.now().plusYears(1);
    static final LocalDate ORIGINAL_VISIT_DATE = BIRTH_DATE.plusDays(1);

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

    int ownerId;
    int petId;
    int visitId;

    @BeforeEach
    final void aPetBornOnBirthDateWithOneVisit() {
        Owner owner = ownerRepository.save(TestData.anOwner());
        Pet pet = TestData.aPet();
        pet.setBirthDate(BIRTH_DATE);
        pet.setOwner(owner);
        pet.setType(petTypeRepository.save(TestData.aPetType("dog")));
        petRepository.save(pet);
        Visit visit = new Visit();
        visit.setDate(ORIGINAL_VISIT_DATE);
        visit.setDescription("rabies shot");
        pet.addVisit(visit);
        visitRepository.save(visit);
        ownerId = owner.getId();
        petId = pet.getId();
        visitId = visit.getId();
    }

    static final String BEFORE_BIRTH_ERROR = "Visit date cannot be before the pet's birth date (" + BIRTH_DATE + ").";
    static final String TOO_FAR_AHEAD_ERROR = "Visit date cannot be more than one year ahead (after "
            + ONE_YEAR_FROM_TODAY + ").";

    static Stream<Arguments> refusedDates() {
        return Stream.of(
                Arguments.of(LocalDate.of(9, 7, 20), BEFORE_BIRTH_ERROR),
                Arguments.of(BIRTH_DATE.minusDays(1), BEFORE_BIRTH_ERROR),
                Arguments.of(ONE_YEAR_FROM_TODAY.plusDays(1), TOO_FAR_AHEAD_ERROR));
    }

    @ParameterizedTest
    @MethodSource("refusedDates")
    void refusesADateOutsideTheRange(LocalDate date, String expectedError) throws Exception {
        for (MockHttpServletRequestBuilder request : everyVisitWrite(date)) {
            mockMvc.perform(request)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.detail").value(expectedError));
        }

        assertThat(visitRepository.findAll())
                .extracting(Visit::getId, Visit::getDate)
                .containsExactly(tuple(visitId, ORIGINAL_VISIT_DATE));
    }

    @Test
    void acceptsTheBoundaries() throws Exception {
        for (MockHttpServletRequestBuilder request : everyVisitWrite(BIRTH_DATE)) {
            mockMvc.perform(request).andExpect(status().is2xxSuccessful());
        }
        for (MockHttpServletRequestBuilder request : everyVisitWrite(ONE_YEAR_FROM_TODAY)) {
            mockMvc.perform(request).andExpect(status().is2xxSuccessful());
        }
    }

    private List<MockHttpServletRequestBuilder> everyVisitWrite(LocalDate date) {
        String visitFields = """
                {"date": "%s", "description": "ate the Christmas tinsel"}""".formatted(date);
        String visit = """
                {"date": "%s", "description": "ate the Christmas tinsel", "petId": %d}""".formatted(date, petId);
        return List.of(
                post("/api/owners/{ownerId}/pets/{petId}/visits", ownerId, petId)
                        .contentType(MediaType.APPLICATION_JSON).content(visitFields),
                post("/api/visits").contentType(MediaType.APPLICATION_JSON).content(visit),
                put("/api/visits/{visitId}", visitId).contentType(MediaType.APPLICATION_JSON).content(visitFields));
    }
}
