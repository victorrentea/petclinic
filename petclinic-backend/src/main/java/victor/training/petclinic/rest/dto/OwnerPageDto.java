package victor.training.petclinic.rest.dto;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners, with the totals of the whole filtered list.")
public record OwnerPageDto(
        @Schema(requiredMode = REQUIRED) List<OwnerRowDto> content,
        @Schema(requiredMode = REQUIRED, description = "Owners matching the filter, on all pages.") long totalElements,
        @Schema(requiredMode = REQUIRED) int totalPages,
        @Schema(requiredMode = REQUIRED, description = "Zero-based number of this page.") int number,
        @Schema(requiredMode = REQUIRED, description = "The requested page size.") int size) {
}
