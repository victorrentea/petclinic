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

    public record VisitConfirmation(boolean confirmed) {}

    @McpTool(
        name = "list_visits",
        description = "List veterinary visits for every pet of the authenticated owner."
    )
    @Transactional(readOnly = true)
    public List<VisitView> listVisits() {
        return listVisitsFor(McpSecurity.currentOwnerId());
    }

    @Transactional(readOnly = true)
    List<VisitView> listVisitsFor(int ownerId) {
        Owner owner = ownerRepository.findById(ownerId)
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
            @McpToolParam(description = "Visit date (yyyy-MM-dd); defaults to today if omitted", required = false) String date,
            @McpToolParam(description = "Visit description (reason, diagnosis, notes...)", required = true) String description) {
        return createVisitFor(McpSecurity.currentOwnerId(), context, petId, date, description);
    }

    @Transactional
    String createVisitFor(int ownerId, McpSyncRequestContext context, int petId, String date, String description) {
        Pet pet = petRepository.findById(petId)
            .orElseThrow(() -> new IllegalArgumentException("Pet not found: " + petId));
        if (pet.getOwner() == null || pet.getOwner().getId() != ownerId) {
            throw new IllegalArgumentException("Pet " + petId + " does not belong to owner " + ownerId);
        }
        LocalDate visitDate;
        if (date == null || date.isBlank()) {
            visitDate = LocalDate.now();
        } else {
            visitDate = LocalDate.parse(date);
        }

        if (context != null && context.elicitEnabled()) {
            String prompt = "Create visit for pet '" + pet.getName() + "' on " + visitDate
                + " — \"" + description + "\"? Set confirmed=true to proceed.";
            StructuredElicitResult<VisitConfirmation> elicit =
                context.elicit(e -> e.message(prompt), VisitConfirmation.class);
            if (elicit.action() != ElicitResult.Action.ACCEPT || !elicit.structuredContent().confirmed()) {
                return "Visit creation cancelled by user.";
            }
        }

        Visit v = new Visit();
        v.setPet(pet);
        v.setDate(visitDate);
        v.setDescription(description);
        Visit saved = visitRepository.save(v);
        return "Created visit id=" + saved.getId() + " for pet '" + pet.getName() + "' on " + visitDate;
    }
}
