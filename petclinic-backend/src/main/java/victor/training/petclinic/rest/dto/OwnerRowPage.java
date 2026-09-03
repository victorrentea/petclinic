package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Documentation-only view of {@code PagedModel<OwnerRowDto>}: springdoc cannot render the
 * generic type, and this is the exact JSON the owners grid receives.
 */
@Schema(name = "OwnerRowPage", description = "One page of the owners grid.")
public record OwnerRowPage(
        @Schema(description = "The owners on this page.") List<OwnerRowDto> content,
        @Schema(description = "Where this page sits in the whole result set.") PageMetadata page) {

    @Schema(name = "PageMetadata")
    public record PageMetadata(
            @Schema(example = "10", description = "Rows per page.") long size,
            @Schema(example = "0", description = "Zero-based page number.") long number,
            @Schema(example = "28", description = "Owners matching the filter, across all pages.") long totalElements,
            @Schema(example = "3", description = "Number of pages available.") long totalPages) {
    }
}
