package victor.training.petclinic.rest.dto;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import jakarta.validation.constraints.Min;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.PARAMETER;

/** The query of GET /api/owners. A missing parameter takes its default; an invalid one is a 400, never clamped. */
public record OwnerListRequest(
        @Schema(description = "Case-sensitive last-name prefix; empty lists every owner.") String lastName,
        @Min(0) @Schema(description = "Zero-based page number.", defaultValue = "0") Integer page,
        @AllowedPageSize @Schema(description = "Owners per page.", allowableValues = {
                "5", "10", "20"}, defaultValue = "10") Integer size,
        @Schema(defaultValue = "name") SortKey sort,
        @Schema(defaultValue = "asc") SortDirection direction){

    private static final Set<Integer> ALLOWED_PAGE_SIZES = Set.of(5, 10, 20);

    /** Wire values are the lowercase constant names, matched exactly. The id suffix makes every chain tie-safe. */
    public enum SortKey {
        name("lastName", "firstName", "id"), city("city", "lastName", "firstName", "id");

        private final String[] properties;

        SortKey(String... properties) {
            this.properties = properties;
        }
    }

    public enum SortDirection {
        asc, desc
    }

    public OwnerListRequest {
        if (lastName == null) {
            lastName = "";
        }
        if (page == null) {
            page = 0;
        }
        if (size == null) {
            size = 10;
        }
        if (sort == null) {
            sort = SortKey.name;
        }
        if (direction == null) {
            direction = SortDirection.asc;
        }
    }

    public Pageable pageable() {
        Sort.Direction springDirection = Sort.Direction.fromString(direction.name());
        return PageRequest.of(page, size, Sort.by(springDirection, sort.properties));
    }

    @Target({FIELD, PARAMETER})
    @Retention(RetentionPolicy.RUNTIME)
    @Constraint(validatedBy = AllowedPageSize.Validator.class)
    public @interface AllowedPageSize {
        String message() default "must be 5, 10 or 20";

        Class<?>[] groups() default {};

        Class<? extends Payload>[] payload() default {};

        class Validator implements ConstraintValidator<AllowedPageSize, Integer> {
            @Override
            public boolean isValid(Integer size, ConstraintValidatorContext context) {
                return ALLOWED_PAGE_SIZES.contains(size);
            }
        }
    }
}
