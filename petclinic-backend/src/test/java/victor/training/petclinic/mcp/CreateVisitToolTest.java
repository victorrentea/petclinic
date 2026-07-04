package victor.training.petclinic.mcp;

import java.time.LocalDate;
import java.util.List;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.annotation.Transactional;

import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class CreateVisitToolTest {

    @Autowired PetClinicMcp petClinicMcp;
    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;
    @Autowired VisitRepository visitRepository;

    private int ownerId;
    private int petId;
    private final LocalDate future = LocalDate.now().plusDays(7);

    @BeforeEach
    void setUp() {
        Pet pet = new Pet()
            .setName("Rex")
            .setBirthDate(LocalDate.of(2020, 1, 1))
            .setType(petRepository.findPetTypes().get(0));
        Owner owner = new Owner()
            .setFirstName("Tdd")
            .setLastName("Creator")
            .setAddress("1 Test Way")
            .setCity("Testville")
            .setTelephone("0000000000");
        owner.addPet(pet);
        ownerRepository.save(owner);
        ownerId = owner.getId();
        petId = pet.getId();
        authenticateAs(ownerId);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void books_visit_directly_without_any_elicitation() {
        String result = petClinicMcp.createVisit(petId, future, "Vaccination");

        assertThat(result).contains("Created visit").contains("Rex")
            .contains(future.toString());
        assertThat(visitRepository.findByPetId(petId))
            .extracting(v -> v.getDescription())
            .contains("Vaccination");
    }

    @Test
    void unknown_pet_is_rejected() {
        assertThatThrownBy(() -> petClinicMcp.createVisit(999_999, future, "Checkup"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Pet not found");
    }

    @Test
    void pet_of_another_owner_is_rejected() {
        Pet otherPet = new Pet()
            .setName("Bella")
            .setBirthDate(LocalDate.of(2021, 2, 2))
            .setType(petRepository.findPetTypes().get(0));
        Owner other = new Owner()
            .setFirstName("Other")
            .setLastName("Owner")
            .setAddress("9 Elsewhere")
            .setCity("Faraway")
            .setTelephone("0000000000");
        other.addPet(otherPet);
        ownerRepository.save(other);

        assertThatThrownBy(() -> petClinicMcp.createVisit(otherPet.getId(), future, "Checkup"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("does not belong to owner");
    }

    @Test
    void past_date_is_rejected() {
        LocalDate past = LocalDate.now().minusDays(1);

        assertThatThrownBy(() -> petClinicMcp.createVisit(petId, past, "Checkup"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("must be today or in the future");
    }

    @Test
    void rejects_booking_when_pet_already_has_max_upcoming_visits() {
        // Fill the pet up to the cap with future visits, on distinct future days.
        for (int i = 0; i < PetClinicMcp.MAX_UPCOMING_VISITS_PER_PET; i++) {
            petClinicMcp.createVisit(petId, LocalDate.now().plusDays(i + 1), "Booking " + i);
        }

        // One more must be rejected as service abuse.
        assertThatThrownBy(() ->
            petClinicMcp.createVisit(petId, future.plusDays(100), "One too many"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already has the maximum")
            .hasMessageContaining(String.valueOf(PetClinicMcp.MAX_UPCOMING_VISITS_PER_PET));
    }

    private static void authenticateAs(int ownerId) {
        var auth = new UsernamePasswordAuthenticationToken(
            String.valueOf(ownerId),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_MCP")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
