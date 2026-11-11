package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

@Schema(description = "One row of the visits grid.")
public record VisitRowDto(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "1") int id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "2013-01-01") LocalDate date,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "rabies shot") String description,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "Leo") String petName,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "1") int ownerId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "George") String ownerFirstName,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "Franklin") String ownerLastName) {
}
