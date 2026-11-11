package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/** One row of the visits grid, selected straight into this shape by {@code VisitRepository.findGridPage}. */
@Schema(description = "One row of the visits grid.")
public record VisitRowDto(
        @Schema(requiredMode = REQUIRED, example = "1", description = "The ID of the visit.") Integer id,
        @Schema(requiredMode = REQUIRED, example = "2013-01-01", description = "The visit's date.") LocalDate date,
        @Schema(requiredMode = REQUIRED, example = "rabies shot",
                description = "The description of the visit.") String description,
        @Schema(requiredMode = REQUIRED, example = "7", description = "The ID of the pet.") Integer petId,
        @Schema(requiredMode = REQUIRED, example = "Leo", description = "The name of the pet.") String petName,
        @Schema(requiredMode = REQUIRED, example = "1", description = "The ID of the pet's owner.") Integer ownerId,
        @Schema(requiredMode = REQUIRED, example = "George",
                description = "The first name of the owner.") String ownerFirstName,
        @Schema(requiredMode = REQUIRED, example = "Franklin",
                description = "The last name of the owner.") String ownerLastName) {
}
