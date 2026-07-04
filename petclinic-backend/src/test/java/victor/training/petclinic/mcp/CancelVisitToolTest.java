package victor.training.petclinic.mcp;

import java.time.LocalDate;
import java.util.List;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class CancelVisitToolTest {

    @Autowired PetClinicMcp petClinicMcp;
    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;
    @Autowired VisitRepository visitRepository;

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void cancel_deletes_matching_future_visit() {
        Owner owner = ownerWithPet();
        Pet pet = owner.getPets().get(0);
        LocalDate futureDate = LocalDate.now().plusDays(7);
        pet.addVisit(new Visit().setDate(futureDate).setDescription("Check"));
        ownerRepository.save(owner);
        authenticateAs(owner.getId());

        String result = petClinicMcp.cancelVisit(futureDate);

        assertThat(result).contains("Cancelled 1 visit(s)").contains(futureDate.toString());
        assertThat(visitRepository.findByPetId(pet.getId())).isEmpty();
    }

    @Test
    void cancel_returns_no_visits_when_none_match_date() {
        Owner owner = ownerWithPet();
        authenticateAs(owner.getId());
        LocalDate futureDate = LocalDate.now().plusDays(14);

        String result = petClinicMcp.cancelVisit(futureDate);

        assertThat(result).contains("No upcoming visits found").contains(futureDate.toString());
    }

    @Test
    void cancel_rejects_past_date() {
        Owner owner = ownerWithPet();
        authenticateAs(owner.getId());

        assertThatThrownBy(() -> petClinicMcp.cancelVisit(LocalDate.of(2020, 1, 1)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("must be today or in the future");
    }

    @Test
    void cancel_throws_when_owner_not_found() {
        authenticateAs(999_999);

        assertThatThrownBy(() -> petClinicMcp.cancelVisit(LocalDate.now().plusDays(1)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Owner not found");
    }

    @Test
    void create_books_visit_directly_without_elicitation() {
        Owner owner = ownerWithPet();
        Pet pet = owner.getPets().get(0);
        authenticateAs(owner.getId());

        String result = petClinicMcp.createVisit(pet.getId(),
            LocalDate.now().plusDays(7), "Test visit");

        assertThat(result).contains("Created visit").contains("Whiskers");
        assertThat(visitRepository.findByPetId(pet.getId()))
            .extracting(Visit::getDescription)
            .contains("Test visit");
    }

    @Test
    void create_rejects_pet_not_belonging_to_caller() {
        Owner owner1 = ownerWithPet();
        Owner owner2 = ownerWithPet();
        Pet petOfOwner2 = owner2.getPets().get(0);
        authenticateAs(owner1.getId());

        assertThatThrownBy(() -> petClinicMcp.createVisit(petOfOwner2.getId(),
                LocalDate.now().plusDays(7), "Attempt"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("does not belong to owner");
    }

    @Test
    void create_rejects_unknown_pet_id() {
        Owner owner = ownerWithPet();
        authenticateAs(owner.getId());

        assertThatThrownBy(() -> petClinicMcp.createVisit(999_999,
                LocalDate.now().plusDays(7), "Visit"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Pet not found");
    }

    @Test
    void create_rejects_past_date() {
        Owner owner = ownerWithPet();
        Pet pet = owner.getPets().get(0);
        authenticateAs(owner.getId());

        assertThatThrownBy(() -> petClinicMcp.createVisit(pet.getId(), LocalDate.of(2020, 1, 1), "Old visit"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("must be today or in the future");
    }

    @Test
    void list_throws_when_owner_not_found() {
        authenticateAs(999_999);

        assertThatThrownBy(() -> petClinicMcp.listVisits())
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Owner not found");
    }

    private Owner ownerWithPet() {
        Pet pet = new Pet()
            .setName("Whiskers")
            .setBirthDate(LocalDate.of(2022, 3, 10))
            .setType(petRepository.findPetTypes().get(0));
        Owner owner = new Owner()
            .setFirstName("Test")
            .setLastName("Owner_CVT")
            .setAddress("1 Street")
            .setCity("TestCity")
            .setTelephone("0000000000");
        owner.addPet(pet);
        return ownerRepository.save(owner);
    }

    private static void authenticateAs(int ownerId) {
        var auth = new UsernamePasswordAuthenticationToken(
            String.valueOf(ownerId),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_MCP")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
