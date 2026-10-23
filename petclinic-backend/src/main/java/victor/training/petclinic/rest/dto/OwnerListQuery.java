package victor.training.petclinic.rest.dto;

import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;

/** Query parameters of GET /api/owners. A missing parameter takes its default. */
public record OwnerListQuery(
        @Schema(description = "Keep only owners whose last name starts with this (case-sensitive).",
                defaultValue = "") String lastName,
        @Min(0) @Schema(description = "0-based page index.", defaultValue = "0", minimum = "0") Integer page,
        @Schema(description = "Owners per page.", defaultValue = "10", allowableValues = {
                "5", "10", "20"}) Integer size,
        @Schema(description = "Sort key.", defaultValue = "name") OwnerSortKey sort,
        @Schema(description = "Sort direction.", defaultValue = "asc") SortDirection dir){

    private static final Set<Integer> ALLOWED_SIZES = Set.of(5, 10, 20);

    public OwnerListQuery {
        lastName = lastName == null ? "" : lastName;
        page = page == null ? 0 : page;
        size = size == null ? 10 : size;
        sort = sort == null ? OwnerSortKey.name : sort;
        dir = dir == null ? SortDirection.asc : dir;
    }

    @Hidden
    @AssertTrue(message = "must be one of 5, 10, 20")
    public boolean isAllowedSize() {
        return ALLOWED_SIZES.contains(size);
    }

    public Pageable toPageable() {
        return PageRequest.of(page, size, sort.toSort(dir));
    }
}
