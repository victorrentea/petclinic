package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

/** Which page of owners to list, limited to what the Owners grid offers. */
public record OwnerListQuery(
        @Schema(description = "0-based page number", defaultValue = "0") @Min(0) Integer page,

        @Schema(description = "Owners per page, 10 by default", allowableValues = {
                "5", "10", "20"}) @Pattern(regexp = "5|10|20", message = "must be 5, 10 or 20") String size,

        @Schema(description = SORT_HINT, defaultValue = "name,asc") @Pattern(regexp = "(name|city)(,(asc|desc))?",
                message = "must be " + SORT_HINT) String sort){

    private static final String SORT_HINT = "name or city, optionally followed by ,asc or ,desc";

    public OwnerListQuery {
        page = page == null ? 0 : page;
        size = size == null ? "10" : size;
        sort = sort == null ? "name" : sort;
    }

    public Pageable toPageable() {
        return PageRequest.of(page, Integer.parseInt(size), toSort());
    }

    // ties end on id, so consecutive pages never repeat or skip an owner
    private Sort toSort() {
        Direction direction = sort.endsWith(",desc") ? Direction.DESC : Direction.ASC;
        if (sort.startsWith("city")) {
            return Sort.by(direction, "city").and(Sort.by("lastName", "firstName", "id"));
        }
        return Sort.by(direction, "lastName", "firstName").and(Sort.by("id"));
    }
}
