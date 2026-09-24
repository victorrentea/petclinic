package victor.training.petclinic.rest.dto;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One owner as a row of the owners grid: no pet details, no visits.")
public record OwnerRowDto(
        @Schema(requiredMode = REQUIRED) Integer id,
        @Schema(requiredMode = REQUIRED) String firstName,
        @Schema(requiredMode = REQUIRED) String lastName,
        @Schema(requiredMode = REQUIRED) String address,
        @Schema(requiredMode = REQUIRED) String city,
        @Schema(description = "Null when the owner has no phone.") String telephone,
        @Schema(requiredMode = REQUIRED,
                description = "The names of the owner's pets, alphabetically.") List<String> petNames) {
}
