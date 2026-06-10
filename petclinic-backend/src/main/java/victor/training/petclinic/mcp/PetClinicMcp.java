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
        int ownerId = McpSecurity.currentOwnerId();
        Owner owner = ownerRepository.findById(ownerId).orElseThrow();
        List<VisitView> visits = new ArrayList<>();
        for (Pet pet : owner.getPets()) {
            for (Visit v : pet.getVisits()) {
                visits.add(new VisitView(v.getId(), pet.getId(), pet.getName(), v.getDate(), v.getTime(), v.getDescription()));
            }
        }
        return visits;
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
        Pet pet = petRepository.findById(petId)
            .orElseThrow(() -> new IllegalArgumentException("Pet not found: " + petId));
        if (pet.getOwner() == null || pet.getOwner().getId() != ownerId) {
            throw new IllegalArgumentException(
                "Pet '" + pet.getName() + "' does not belong to owner " + ownerId);
        }
        requireFutureDate(visitDate);
        if (visitDate.isEqual(LocalDate.now()) && visitTime != null && visitTime.isBefore(LocalTime.now())) {
            throw new IllegalArgumentException("Visit time must be in the future: " + visitTime);
        }
        requireUnderUpcomingVisitCap(pet);

        Visit visit = new Visit();
        visit.setDate(visitDate);
        visit.setTime(visitTime);
        visit.setDescription(description);
        pet.addVisit(visit); // maintains both sides so the cap check sees freshly-booked visits this tx
        Visit saved = visitRepository.save(visit);

        return "Created visit #%d for %s on %s at %s".formatted(saved.getId(), pet.getName(), visitDate, visitTime);
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
        int ownerId = McpSecurity.currentOwnerId();
        Owner owner = ownerRepository.findByIdFetchingPets(ownerId)
            .orElseThrow(() -> new IllegalArgumentException("Owner not found: " + ownerId));

        // Navigate the mapped Pet→Visit association and filter the matching date (lazy; safe under @Transactional).
        List<Visit> matching = owner.getPets().stream()
            .flatMap(pet -> pet.getVisits().stream())
            .filter(v -> v.getDate().equals(visitDate))
            .toList();
        // Detach from the managed collection too, otherwise cascade=ALL re-persists the visit on flush.
        matching.forEach(v -> {
            v.getPet().getVisits().remove(v);
            visitRepository.delete(v);
        });

        if (matching.isEmpty()) {
            return "No upcoming visits found on " + visitDate;
        }
        return "Cancelled " + matching.size() + " visit(s) on " + visitDate;
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
            + "emergency. "
    )
    public String callVetAmbulance(McpSyncRequestContext context) {
        // Dispatching an ambulance is costly and irreversible — NEVER let the LLM trigger it on its own.
        // We force a HUMAN elicitation: the person in front of the chatbot must type the destination
        // address and explicitly approve ("Request Ambulance"). No human approval => no dispatch.
        if (context == null || !context.elicitEnabled()) {
            throw new IllegalStateException(
                "Dispatching a vet ambulance requires human elicitation, which this client does not support.");
        }
        StructuredElicitResult<AmbulanceAddressInput> answer = context.elicit(
            spec -> spec.message("Confirm the exact street address where the vet ambulance should be sent. "
                + "Approve only if you really want an ambulance dispatched."),
            AmbulanceAddressInput.class);

        if (answer.action() != ElicitResult.Action.ACCEPT) {
            return "Vet ambulance was not requested."; // human declined or cancelled
        }
        AmbulanceAddressInput input = answer.structuredContent();
        if (input == null || input.address() == null || input.address().isBlank()) {
            throw new IllegalArgumentException("A destination address is required to dispatch the ambulance.");
        }
        return "Vet ambulance dispatched to " + input.address();
    }
}
