package victor.training.petclinic.rest.dto;

import java.util.List;

import jakarta.validation.constraints.NotNull;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners")
public record OwnerPageDto(
        @NotNull @Schema(description = "The owners on this page") List<OwnerDto> content,
        @NotNull @Schema(example = "12",
                description = "Owners matching the filter, across all pages") Long totalElements,
        @NotNull @Schema(example = "2", description = "Number of pages for the current size") Integer totalPages,
        @NotNull @Schema(example = "0", description = "0-based index of this page") Integer number,
        @NotNull @Schema(example = "10", description = "Requested page size") Integer size) {
}
