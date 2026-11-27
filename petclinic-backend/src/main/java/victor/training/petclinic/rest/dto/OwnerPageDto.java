package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners.")
public record OwnerPageDto(
        List<OwnerDto> content,
        @Schema(description = "Owners matching the search, over all pages.") long totalElements,
        int totalPages,
        @Schema(description = "0-based index of this page.") int number,
        int size) {
}
