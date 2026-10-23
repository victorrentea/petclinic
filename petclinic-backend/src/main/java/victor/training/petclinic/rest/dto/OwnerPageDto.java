package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners, sorted and filtered as requested.")
public record OwnerPageDto(
        @Schema(description = "The owners on this page, with their pets.",
                requiredMode = Schema.RequiredMode.REQUIRED) List<OwnerDto> content,
        @Schema(description = "How many owners match the filter, across all pages.", example = "26",
                requiredMode = Schema.RequiredMode.REQUIRED) long totalElements) {
}
