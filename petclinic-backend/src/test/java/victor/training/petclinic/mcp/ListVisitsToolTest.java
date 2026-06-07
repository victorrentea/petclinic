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
import victor.training.petclinic.model.PetType;
import victor.training.petclinic.model.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class ListVisitsToolTest {

    @Autowired PetClinicMcp petClinicMcp;
    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;
    @Autowired VisitRepository visitRepository;

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void lists_visits_of_authenticated_owner() {
        PetType firstType = petRepository.findPetTypes().get(0);
        Pet pet = new Pet()
            .setName("Rex")
            .setBirthDate(LocalDate.of(2020, 1, 1))
            .setType(firstType);
        Owner owner = new Owner()
            .setFirstName("Tdd")
            .setLastName("Tester")
            .setAddress("1 Test Way")
            .setCity("Testville")
            .setTelephone("0000000000");
        owner.addPet(pet);
        ownerRepository.save(owner);

        visitRepository.save(new Visit()
            .setPet(pet)
            .setDate(LocalDate.of(2026, 5, 24))
            .setDescription("Annual checkup"));

        authenticateAs(owner.getId());

        List<PetClinicMcp.VisitView> visits = petClinicMcp.listVisits();

        assertThat(visits)
            .extracting(PetClinicMcp.VisitView::description)
            .contains("Annual checkup");
    }

    private static void authenticateAs(int ownerId) {
        var auth = new UsernamePasswordAuthenticationToken(
            String.valueOf(ownerId),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_MCP")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
