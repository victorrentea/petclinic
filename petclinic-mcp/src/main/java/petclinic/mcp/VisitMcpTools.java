package petclinic.mcp;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.springaicommunity.mcp.annotation.McpTool;
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

@Component
public class VisitMcpTools {

    private final OwnerRepository ownerRepository;
    private final PetRepository petRepository;
    private final VisitRepository visitRepository;

    public VisitMcpTools(OwnerRepository ownerRepository, PetRepository petRepository, VisitRepository visitRepository) {
        this.ownerRepository = ownerRepository;
        this.petRepository = petRepository;
        this.visitRepository = visitRepository;
    }

    public record VisitView(int id, int petId, String petName, LocalDate date, String description) {}

    public record VisitPhoneInput(String phone) {}

    @McpTool(
        name = "list_visits",
        description = "List veterinary visits for every pet of the authenticated owner.",
        annotations = @McpTool.McpAnnotations(readOnlyHint = true, openWorldHint = false)
    )
    public List<VisitView> listVisits() {
        int ownerId = McpSecurity.currentOwnerId();
        Owner owner = ownerRepository.findByIdFetchingPets(ownerId)
            .orElseThrow(() -> new IllegalArgumentException("Owner not found: " + ownerId));
        List<VisitView> result = new ArrayList<>();
        for (Pet pet : owner.getPets()) {
            for (Visit v : visitRepository.findByPetId(pet.getId())) {
                result.add(new VisitView(v.getId(), pet.getId(), pet.getName(), v.getDate(), v.getDescription()));
            }
        }
        return result;
    }

    @McpTool(
        name = "create_visit",
        description = "Create a new vet visit for one of the authenticated owner's pets. "
            + "Asks the user (via elicitation) to confirm before writing."
    )
    @Transactional
    public String createVisit(
            McpSyncRequestContext context,
            @McpToolParam(description = "Pet ID (must belong to the authenticated owner)", required = true) int petId,
            @McpToolParam(description = "Visit date (yyyy-MM-dd); must be today or in the future", required = true) String date,
            @McpToolParam(description = "Visit description (reason, diagnosis, notes...)", required = true) String description) {
        int ownerId = McpSecurity.currentOwnerId();
        Pet pet = petRepository.findById(petId)
            .orElseThrow(() -> new IllegalArgumentException("Pet not found: " + petId));
        if (pet.getOwner() == null || pet.getOwner().getId() != ownerId) {
            throw new IllegalArgumentException("Pet " + petId + " does not belong to owner " + ownerId+ " your pets are :" +
                petRepository.findAll().stream()
                    .filter(p -> p.getOwner() != null && p.getOwner().getId() == ownerId)
                    .map(Pet::getId)
                    .toList()

                );
        }
        LocalDate visitDate = LocalDate.parse(date);
        requireFutureDate(visitDate);

        if (context == null || !context.elicitEnabled()) {
            throw new IllegalStateException(
                "create_visit requires an MCP client that supports elicitation (owner must confirm).");
        }
        String prompt = "Create visit for pet '" + pet.getName() + "' on " + visitDate
            + " — \"" + description + "\". No phone number on file for you — please provide one to receive reminders.";
        StructuredElicitResult<VisitPhoneInput> elicit =
            context.elicit(e -> e.message(prompt), VisitPhoneInput.class);
        if (elicit.action() != ElicitResult.Action.ACCEPT) {
            return "Visit creation cancelled by user.";
        }
        VisitPhoneInput input = elicit.structuredContent();
        if (input == null || input.phone() == null || input.phone().isBlank()) {
            throw new IllegalArgumentException("Phone number is required to schedule a visit.");
        }
        Owner owner = pet.getOwner();
        owner.setTelephone(input.phone().trim());
        ownerRepository.save(owner);

        Visit v = new Visit();
        v.setPet(pet);
        v.setDate(visitDate);
        v.setDescription(description);
        Visit saved = visitRepository.save(v);
        return "Created visit id=" + saved.getId() + " for pet '" + pet.getName() + "' on " + visitDate
            + "; reminders will be sent to " + owner.getTelephone();
    }

    @McpTool(
        name = "cancel_visit",
        description = "Cancel an upcoming vet visit for one of the authenticated owner's pets. "
            + "Only visits dated strictly in the future can be cancelled.",
        annotations = @McpTool.McpAnnotations(destructiveHint = true)
    )
    @Transactional
    public String cancelVisit(
            @McpToolParam(description = "Visit date (yyyy-MM-dd); must be in the future", required = true) String date) {
        LocalDate visitDate = LocalDate.parse(date);
        requireFutureDate(visitDate);

        int ownerId = McpSecurity.currentOwnerId();
        Owner owner = ownerRepository.findByIdFetchingPets(ownerId)
            .orElseThrow(() -> new IllegalArgumentException("Owner not found: " + ownerId));

        int cancelled = 0;
        for (Pet pet : owner.getPets()) {
            for (Visit v : visitRepository.findByPetId(pet.getId())) {
                if (v.getDate().equals(visitDate)) {
                    visitRepository.delete(v);
                    cancelled++;
                }
            }
        }
        if (cancelled == 0) {
            return "No upcoming visits found on " + visitDate;
        }
        return "Cancelled " + cancelled + " visit(s) on " + visitDate;
    }

    private static void requireFutureDate(LocalDate d) {
        if (d.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Visit date must be today or in the future: " + d);
        }
    }
}
