package victor.training.petclinic.rest;

import org.springframework.data.domain.Sort;

import java.util.Set;

/**
 * Enforces the allowed sort keys ({@code name}, {@code city}) and page sizes ({@code 5, 10, 20})
 * for the owner listing endpoint, independent of framework binding.
 */
public final class OwnerPaginationValidator {

    static final Set<Integer> ALLOWED_SIZES = Set.of(5, 10, 20);

    private OwnerPaginationValidator() {
    }

    /**
     * Maps the public sort key to a {@link Sort} using {@code direction}.
     *
     * @throws IllegalArgumentException for unknown sort keys
     */
    public static Sort toSort(String sortKey, Sort.Direction direction) {
        return switch (sortKey) {
            case "name" -> Sort.by(direction, "lastName", "firstName");
            case "city" -> Sort.by(direction, "city");
            default -> throw new IllegalArgumentException("Invalid sort key: '" + sortKey + "'. Allowed: name, city");
        };
    }

    /**
     * Validates that {@code size} is in the allowed set and {@code page} is non-negative.
     *
     * @throws IllegalArgumentException on violation
     */
    public static void validatePageParams(int page, int size) {
        if (!ALLOWED_SIZES.contains(size)) {
            throw new IllegalArgumentException("Invalid page size: " + size + ". Allowed: " + ALLOWED_SIZES);
        }
        if (page < 0) {
            throw new IllegalArgumentException("Page number must be non-negative, got: " + page);
        }
    }
}
