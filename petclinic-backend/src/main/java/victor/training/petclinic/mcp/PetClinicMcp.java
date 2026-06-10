package victor.training.petclinic.mcp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springaicommunity.mcp.annotation.McpTool;
import org.springaicommunity.mcp.annotation.McpTool.McpAnnotations;
import org.springaicommunity.mcp.annotation.McpToolParam;
import org.springaicommunity.mcp.context.McpSyncRequestContext;
import org.springaicommunity.mcp.context.StructuredElicitResult;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import io.modelcontextprotocol.spec.McpSchema.ElicitResult;

import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.model.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.VisitRepository;

@RequiredArgsConstructor
@Component
public class PetClinicMcp {

    /**
     * Service-abuse guardrail: a single pet may hold at most this many UPCOMING visits. Blocks
     * mass-booking attempts (e.g. "one appointment every hour for the entire week") at the tool level,
     * so the rule holds no matter which client (LLM, UI, script) calls create_visit.
     */
    static final int MAX_UPCOMING_VISITS_PER_PET = 3;

    private final OwnerRepository ownerRepository;
    private final PetRepository petRepository;
    private final VisitRepository visitRepository;

    @McpTool(
        name = "get_owner_profile",
        description = "Fetch the authenticated owner's profile — name, address, phone and the list of "
            + "pets. Takes NO arguments: the owner is resolved from the per-request identity header the "
            + "calling application attaches (not from anything the model supplies), so it cannot be spoofed.",
        annotations = @McpAnnotations(readOnlyHint = true, openWorldHint = false)
    )
    @Transactional(readOnly = true)
    public String getOwnerProfile() {
        int ownerId = McpSecurity.currentOwnerId(); // from the Authorization header, unpacked by McpAuthFilter
        Owner owner = ownerRepository.findById(ownerId)
            .orElseThrow(() -> new IllegalStateException("Authenticated owner not found: " + ownerId));
        String pets = owner.getPets().isEmpty()
            ? "(no pets on file)"
            : owner.getPets().stream().map(this::formatPet).collect(Collectors.joining("\n"));
        return """
            Owner #%d: %s
            Address: %s, %s
            Phone: %s
            Pets:
            %s""".formatted(owner.getId(), owner.getFirstName() + " " + owner.getLastName(),
                owner.getAddress(), owner.getCity(), owner.getTelephone(), pets);
    }

    private String formatPet(Pet pet) {
        String type = pet.getType() == null ? "?" : pet.getType().getName();
        return "- id=%d — %s (%s), born %s".formatted(pet.getId(), pet.getName(), type, pet.getBirthDate());
    }

    public record VisitView(int id, int petId, String petName, LocalDate date, LocalTime time, String description) {}

    public record AmbulanceAddressInput(String address) {}

    @McpTool(
        name = "list_visits",
        description = "List veterinary visits for every pet of the authenticated owner. Takes no "
            + "arguments — the owner is resolved from the per-request identity header, not the model.",
        annotations = @McpAnnotations(readOnlyHint = true, openWorldHint = false)
    )
    @Transactional(readOnly = true)
    public List<VisitView> listVisits() {
       return null;
    }

    @McpTool(
        name = "create_visit",
        description = "Create a new vet visit for one of the authenticated owner's pets "
            + "(date/time, pet, description). Books the visit directly — no confirmation prompt."
    )
    @Transactional
    public String createVisit(
            @McpToolParam(description = "Pet ID (must belong to the authenticated owner)", required = true) int petId,
            @McpToolParam(description = "Visit date (yyyy-MM-dd); must be today or in the future", required = true) LocalDate visitDate,
            @McpToolParam(description = "Exact local time of the appointment (HH:mm), e.g. 08:00", required = true) LocalTime visitTime,
            @McpToolParam(description = "Visit description (reason, diagnosis, notes...)", required = true) String description) {
        int ownerId = McpSecurity.currentOwnerId();
        // elicitation
        return null;
    }

    @McpTool(
        name = "cancel_visit",
        description = "Cancel an upcoming vet visit for one of the authenticated owner's pets. "
            + "Only visits dated strictly in the future can be cancelled.",
        annotations = @McpAnnotations(destructiveHint = true)
    )
    @Transactional
    public String cancelVisit(
            @McpToolParam(description = "Visit date (yyyy-MM-dd); must be in the future", required = true) LocalDate visitDate) {
        requireFutureDate(visitDate);

        return null;
    }

    private void requireUnderUpcomingVisitCap(Pet pet) {
        LocalDate today = LocalDate.now();
        long upcoming = pet.getVisits().stream()
            .filter(v -> v.getDate() != null && !v.getDate().isBefore(today))
            .count();
        if (upcoming >= MAX_UPCOMING_VISITS_PER_PET) {
            throw new IllegalArgumentException(
                "Pet '" + pet.getName() + "' already has the maximum of " + MAX_UPCOMING_VISITS_PER_PET
                    + " upcoming visits. Please cancel an existing visit before booking another.");
        }
    }

    private static void requireFutureDate(LocalDate d) {
        if (d.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Visit date must be today or in the future: " + d);
        }
    }

    @McpTool(
        name = "call_vet_ambulance",
        description = "Dispatch a veterinary ambulance to drive (by car) to a given address for an "
            + "emergency. ELICITS the address from the user and asks them to confirm the dispatch request."
    )
    public String callVetAmbulance(McpSyncRequestContext context) {
        // require user address via elicitation
        return null;
    }
}
