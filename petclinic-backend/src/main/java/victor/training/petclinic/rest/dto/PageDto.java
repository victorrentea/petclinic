package victor.training.petclinic.rest.dto;

import java.util.List;

import org.springframework.data.domain.Page;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * One page of results, in a flat shape we own.
 * <p>
 * Hand-written rather than serializing Spring's {@link Page} directly: {@code PageImpl}'s JSON
 * structure is not part of Spring's public contract (Boot 3.5 warns about exactly this), and
 * {@code openapi.yaml} is this project's contract source of truth — a named record generates a
 * clean, named TypeScript type for the frontend.
 */
// Every component is REQUIRED: the server always sends all five. Saying so is what makes the
// generated TypeScript type non-optional, so the frontend can use `page.totalPages` without a
// null check on a field that is never absent.
@Schema(description = "One page of results.")
public record PageDto<T>(
    @Schema(description = "The results on this page.", requiredMode = Schema.RequiredMode.REQUIRED)
    List<T> content,

    @Schema(example = "28", description = "How many results match in total, across all pages.",
        requiredMode = Schema.RequiredMode.REQUIRED)
    long totalElements,

    @Schema(example = "3", description = "How many pages the results span.",
        requiredMode = Schema.RequiredMode.REQUIRED)
    int totalPages,

    @Schema(example = "0", description = "The zero-based index of this page.",
        requiredMode = Schema.RequiredMode.REQUIRED)
    int number,

    @Schema(example = "10", description = "The effective page size.",
        requiredMode = Schema.RequiredMode.REQUIRED)
    int size
) {
    public static <T> PageDto<T> of(Page<?> page, List<T> content) {
        return new PageDto<>(content, page.getTotalElements(), page.getTotalPages(),
            page.getNumber(), page.getSize());
    }
}
