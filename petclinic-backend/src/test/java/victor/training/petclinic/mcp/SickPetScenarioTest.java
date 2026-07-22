package victor.training.petclinic.mcp;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;

import static org.assertj.core.api.Assertions.assertThat;

// Scenario test for the flow an LLM client drives over MCP when the user says
// "Mițică (my cat) is sick — book an appointment for tomorrow at 8":
//   1. read the me://profile resource to discover the caller's pets,
//   2. parse Mițică's pet id out of the resource text (exactly what the LLM does),
//   3. call create_visit for tomorrow (books directly — no elicitation/confirmation).
// No LLM/API key needed: the LLM's *reasoning* is not under test here — only that the
// tool/resource contract supports this flow end-to-end against a real DB.
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class SickPetScenarioTest {

    @Autowired PetClinicMcp petClinicMcp;
    @Autowired OwnerRepository ownerRepository;
    @Autowired PetRepository petRepository;
    @Autowired VisitRepository visitRepository;

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void sick_cat_flow_reads_profile_then_books_visit_for_tomorrow() {
        // given: the authenticated owner has a cat named Mițică
        Owner owner = ownerWithCat("Mițică");
        authenticateAs(owner.getId());
        LocalDate tomorrow = LocalDate.now().plusDays(1);

        // step 1: the LLM reads the me://profile resource to discover the caller's pets
        String profile = petClinicMcp.getOwnerProfile();
        assertThat(profile).contains("Mițică");

        // step 2: the LLM extracts the pet id from the resource text
        int petId = extractPetId(profile, "Mițică");

        // step 3: the LLM calls create_visit for tomorrow at 08:00 (books directly, no elicitation)
        String result = petClinicMcp.createVisit(petId, tomorrow, LocalTime.of(8, 0),
            "Mițică is sick");

        assertThat(result).contains("Created visit").contains("Mițică")
            .contains(tomorrow.toString()).contains("08:00");

        // then: the visit is persisted for tomorrow at 08:00 local time
        List<Visit> visits = visitRepository.findByPetId(petId);
        assertThat(visits)
            .singleElement()
            .satisfies(v -> {
                assertThat(v.getDate()).isEqualTo(tomorrow);
                assertThat(v.getTime()).isEqualTo(LocalTime.of(8, 0));
                assertThat(v.getDescription()).contains("sick");
            });
    }

    /** Mimics the LLM parsing "- id=12 — Mițică (cat), born ..." out of the profile markdown. */
    private static int extractPetId(String profile, String petName) {
        Matcher m = Pattern.compile("id=(\\d+) — " + Pattern.quote(petName)).matcher(profile);
        assertThat(m.find()).as("pet '%s' with id in profile:%n%s", petName, profile).isTrue();
        return Integer.parseInt(m.group(1));
    }

    private Owner ownerWithCat(String catName) {
        PetType catType = petRepository.findPetTypes().stream()
            .filter(t -> "cat".equalsIgnoreCase(t.getName()))
            .findFirst()
            .orElseGet(() -> petRepository.findPetTypes().get(0));
        Pet cat = new Pet()
            .setName(catName)
            .setBirthDate(LocalDate.of(2021, 4, 15))
            .setType(catType);
        Owner owner = new Owner()
            .setFirstName("Victor")
            .setLastName("Owner_SPS")
            .setAddress("1 Cat Lane")
            .setCity("Bucharest")
            .setTelephone("0700000000");
        owner.addPet(cat);
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
