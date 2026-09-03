package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * One row of the owners grid.
 * <p>
 * Deliberately without pets: the grid pages over 100.000 owners, and fetching a collection
 * alongside pagination makes Hibernate paginate in memory (HHH000104). The pets of an owner are
 * served by the detail endpoint, through {@link OwnerDto}.
 */
@Schema(description = "One owner as shown in the owners grid, without their pets.")
public record OwnerRowDto(
        @Schema(example = "1", description = "The ID of the pet owner.") Integer id,
        @Schema(example = "George", description = "The first name of the pet owner.") String firstName,
        @Schema(example = "Franklin", description = "The last name of the pet owner.") String lastName,
        @Schema(example = "\"110 W. Liberty St.\"", description = "The postal address of the owner.") String address,
        @Schema(example = "Madison", description = "The city of the pet owner.") String city,
        @Schema(example = "\"6085551023\"", description = "The telephone number of the pet owner.") String telephone) {
}
