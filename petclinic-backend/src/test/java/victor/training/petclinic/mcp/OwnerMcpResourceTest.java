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
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerMcpResourceTest {

    @Autowired PetClinicMcp petClinicMcp;
    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void renders_profile_with_pets_for_authenticated_owner() {
        Pet pet = new Pet()
            .setName("Scabbers")
            .setBirthDate(LocalDate.of(2018, 6, 1))
            .setType(petRepository.findPetTypes().get(0));
        Owner ron = new Owner()
            .setFirstName("Ronald")
            .setLastName("Weasley_TST")
            .setAddress("The Burrow")
            .setCity("Ottery St Catchpole")
            .setTelephone("0119544321");
        ron.addPet(pet);
        ownerRepository.save(ron);
        authenticateAs(ron.getId());

        String profile = petClinicMcp.getOwnerProfile();

        assertThat(profile)
            .contains("Ronald").contains("Weasley_TST")
            .contains("The Burrow")
            .contains("Scabbers");
    }

    @Test
    void unknown_id_throws() {
        authenticateAs(999_999);

        assertThatThrownBy(() -> petClinicMcp.getOwnerProfile())
            .isInstanceOf(IllegalStateException.class);
    }

    private static void authenticateAs(int ownerId) {
        var auth = new UsernamePasswordAuthenticationToken(
            String.valueOf(ownerId),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_MCP")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
