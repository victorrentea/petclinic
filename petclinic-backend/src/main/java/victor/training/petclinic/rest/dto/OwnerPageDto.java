package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import lombok.Getter;
import lombok.Setter;

/**
 * One page of owners.
 * <p>
 * Deliberately not Spring's {@code Page}: its JSON shape is explicitly not stable API and
 * serialising it warns as deprecated, so the wire format is declared here instead - which also
 * gives OpenAPI, and therefore the generated frontend types, something real to describe.
 */
@Getter
@Setter
@Schema(description = "One page of owners, together with the total number of matching owners.")
public class OwnerPageDto {

    @Valid
    @Schema(description = "The owners on this page.", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(example = "10000", description = "Total number of owners matching the filter, across all pages.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private long totalElements;

    @Schema(example = "0", description = "Zero-based index of this page.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private int number;

    @Schema(example = "10", description = "Number of owners per page.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private int size;
}
