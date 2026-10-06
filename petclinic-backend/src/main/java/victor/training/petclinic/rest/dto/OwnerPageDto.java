package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

@Schema(description = "One page of owners, with the totals of the whole matching result.")
public record OwnerPageDto(
        @Schema(requiredMode = REQUIRED) List<OwnerDto> content,
        @Schema(requiredMode = REQUIRED, example = "26",
                description = "Owners matching the filter, on all pages.") long totalElements,
        @Schema(requiredMode = REQUIRED, example = "3") int totalPages,
        @Schema(requiredMode = REQUIRED, example = "0", description = "Zero-based index of this page.") int number,
        @Schema(requiredMode = REQUIRED, example = "10") int size) {
}
