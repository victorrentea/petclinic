package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "One page of owners, and how many owners match in total.")
public record OwnerPageDto(
        @Schema(description = "The owners on this page.",
                requiredMode = Schema.RequiredMode.REQUIRED) List<OwnerDto> content,
        @Schema(example = "23", description = "How many owners match, across all pages.",
                requiredMode = Schema.RequiredMode.REQUIRED) long totalElements) {
}
