package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/** One row of the Owners grid: what it shows, so no visits (OwnerDto carries those). */
@Schema(description = "An owner as listed in the Owners grid, with pets by id and name only.")
public record OwnerListItemDto(
        @Schema(example = "1", requiredMode = Schema.RequiredMode.REQUIRED) int id,
        @Schema(example = "\"George\"", requiredMode = Schema.RequiredMode.REQUIRED) String firstName,
        @Schema(example = "\"Franklin\"", requiredMode = Schema.RequiredMode.REQUIRED) String lastName,
        @Schema(example = "\"110 W. Liberty St.\"", requiredMode = Schema.RequiredMode.REQUIRED) String address,
        @Schema(example = "\"Madison\"", requiredMode = Schema.RequiredMode.REQUIRED) String city,
        @Schema(example = "\"6085551023\"", requiredMode = Schema.RequiredMode.REQUIRED) String telephone,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<PetRef> pets) {

    @Schema(name = "OwnerListItemPet", description = "A pet of a listed owner.")
    public record PetRef(
            @Schema(example = "1", requiredMode = Schema.RequiredMode.REQUIRED) int id,
            @Schema(example = "\"Leo\"", requiredMode = Schema.RequiredMode.REQUIRED) String name) {
    }
}
