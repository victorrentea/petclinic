package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners.")
public record OwnerPageDto(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "The owners on the requested page.") List<OwnerDto> content,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "26",
                description = "The number of owners matching the filter, across all pages.") long totalElements) {
}
