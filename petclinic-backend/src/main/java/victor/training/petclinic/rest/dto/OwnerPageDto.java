package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Explicit page envelope for the owners list.
 * <p>
 * Deliberately NOT a Spring {@code Page}/{@code PageImpl} — Boot warns that serializing those is
 * unsupported and their JSON contract unstable — and not a {@code PagedModel}, whose nested
 * metadata leaks an awkward generated schema name into the published openapi.yaml.
 */
@Schema(description = "One page of owners, plus the totals needed to render a paginator.")
public record OwnerPageDto(
    @Schema(description = "The owners on this page.")
    List<OwnerDto> content,

    @Schema(example = "28", description = "Total owners matching the query, across all pages.")
    long totalElements,

    @Schema(example = "3", description = "Total number of pages available.")
    int totalPages,

    @Schema(example = "0", description = "Zero-based index of this page.")
    int number,

    @Schema(example = "10", description = "Page size actually applied, after clamping.")
    int size) {
}
