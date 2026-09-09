package victor.training.petclinic.rest.dto;

import java.util.List;

import org.springframework.data.domain.Page;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * One page of owners, plus the totals a pager needs.
 *
 * <p>
 * Deliberately ours rather than Spring's {@code Page}: Boot logs "Serializing PageImpl instances
 * as-is is not supported" and documents that shape as unstable, and this contract is consumed by
 * TypeScript generated from {@code openapi.yaml} — an unstable shape upstream would surface as a
 * silent frontend break.
 */
@Schema(description = "One page of owners, with the totals needed to render a pager.")
public record OwnerPageDto(
        @Schema(description = "The owners on this page, in the requested order.",
                requiredMode = Schema.RequiredMode.REQUIRED) List<OwnerDto> content,

        @Schema(description = "How many owners match the filter across all pages.", example = "28",
                requiredMode = Schema.RequiredMode.REQUIRED) long totalElements,

        @Schema(description = "How many pages the matching owners fill.", example = "3",
                requiredMode = Schema.RequiredMode.REQUIRED) int totalPages,

        @Schema(description = "Zero-based index of this page.", example = "0",
                requiredMode = Schema.RequiredMode.REQUIRED) int number,

        @Schema(description = "How many owners this page can hold.", example = "10",
                requiredMode = Schema.RequiredMode.REQUIRED) int size) {

    public static OwnerPageDto of(Page<OwnerDto> page) {
        return new OwnerPageDto(page.getContent(), page.getTotalElements(), page.getTotalPages(),
                page.getNumber(), page.getSize());
    }
}
