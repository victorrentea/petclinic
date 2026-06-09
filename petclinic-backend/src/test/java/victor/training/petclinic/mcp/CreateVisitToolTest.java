package victor.training.petclinic.mcp;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.function.Consumer;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import org.springaicommunity.mcp.context.McpSyncRequestContext;
import org.springaicommunity.mcp.context.StructuredElicitResult;
import io.modelcontextprotocol.spec.McpSchema.ElicitResult;

import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
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
    void creates_visit_after_owner_accepts_elicitation_and_provides_phone() {
        McpSyncRequestContext context = elicitingContext(
            new StructuredElicitResult<>(ElicitResult.Action.ACCEPT,
                new PetClinicMcp.VisitPhoneInput("0744123456"), null));

        String result = petClinicMcp.createVisit(context, petId, future, LocalTime.of(10, 30), "Vaccination");

        assertThat(result).contains("Created visit").contains("Rex")
            .contains(future.toString()).contains("10:30");
        assertThat(visitRepository.findByPetId(petId))
            .extracting(v -> v.getDescription())
            .contains("Vaccination");
        // phone is persisted from the elicitation answer
        assertThat(ownerRepository.findById(ownerId).orElseThrow().getTelephone()).isEqualTo("0744123456");
    }

    @Test
    void cancelled_elicitation_does_not_create_visit() {
        McpSyncRequestContext context = elicitingContext(
            new StructuredElicitResult<>(ElicitResult.Action.DECLINE, null, null));

        String result = petClinicMcp.createVisit(context, petId, future, LocalTime.of(10, 30), "Checkup");

        assertThat(result).isEqualTo("Visit creation cancelled by user.");
        assertThat(visitRepository.findByPetId(petId)).isEmpty();
    }

    @Test
    void blank_phone_in_elicitation_is_rejected() {
        McpSyncRequestContext context = elicitingContext(
            new StructuredElicitResult<>(ElicitResult.Action.ACCEPT,
                new PetClinicMcp.VisitPhoneInput("   "), null));

        assertThatThrownBy(() -> petClinicMcp.createVisit(context, petId, future, LocalTime.of(10, 30), "Checkup"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Phone number is required");
    }

    @Test
    void null_structured_content_is_rejected() {
        McpSyncRequestContext context = elicitingContext(
            new StructuredElicitResult<>(ElicitResult.Action.ACCEPT, null, null));

        assertThatThrownBy(() -> petClinicMcp.createVisit(context, petId, future, LocalTime.of(10, 30), "Checkup"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Phone number is required");
    }

    @Test
    void unknown_pet_is_rejected() {
        McpSyncRequestContext context = mock(McpSyncRequestContext.class);

        assertThatThrownBy(() -> petClinicMcp.createVisit(context, 999_999, future, LocalTime.of(10, 30), "Checkup"))
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

        McpSyncRequestContext context = mock(McpSyncRequestContext.class);

        assertThatThrownBy(() -> petClinicMcp.createVisit(context, otherPet.getId(), future, LocalTime.of(10, 30), "Checkup"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("does not belong to owner");
    }

    @Test
    void past_date_is_rejected() {
        McpSyncRequestContext context = mock(McpSyncRequestContext.class);
        LocalDate past = LocalDate.now().minusDays(1);

        assertThatThrownBy(() -> petClinicMcp.createVisit(context, petId, past, LocalTime.of(10, 30), "Checkup"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("must be today or in the future");
    }

    @Test
    void today_with_already_passed_time_is_rejected() {
        // minusHours(1) wraps past midnight to 23:xx (a future time today) — skip in that window
        Assumptions.assumeTrue(LocalTime.now().isAfter(LocalTime.of(1, 0)));
        McpSyncRequestContext context = mock(McpSyncRequestContext.class);
        LocalDate today = LocalDate.now();
        LocalTime pastTime = LocalTime.now().minusHours(1).withSecond(0).withNano(0);

        assertThatThrownBy(() -> petClinicMcp.createVisit(context, petId, today, pastTime, "Checkup"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Visit time must be in the future");
    }

    @Test
    void null_context_means_no_elicitation_support() {
        assertThatThrownBy(() -> petClinicMcp.createVisit(null, petId, future, LocalTime.of(10, 30), "Checkup"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("elicitation");
    }

    @Test
    void elicitation_disabled_means_no_elicitation_support() {
        McpSyncRequestContext context = mock(McpSyncRequestContext.class);
        when(context.elicitEnabled()).thenReturn(false);

        assertThatThrownBy(() -> petClinicMcp.createVisit(context, petId, future, LocalTime.of(10, 30), "Checkup"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("elicitation");
    }

    @SuppressWarnings("unchecked")
    private static McpSyncRequestContext elicitingContext(StructuredElicitResult<PetClinicMcp.VisitPhoneInput> r) {
        McpSyncRequestContext context = mock(McpSyncRequestContext.class);
        when(context.elicitEnabled()).thenReturn(true);
        when(context.elicit(any(Consumer.class), any(Class.class))).thenReturn((StructuredElicitResult) r);
        return context;
    }

    private static void authenticateAs(int ownerId) {
        var auth = new UsernamePasswordAuthenticationToken(
            String.valueOf(ownerId),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_MCP")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
