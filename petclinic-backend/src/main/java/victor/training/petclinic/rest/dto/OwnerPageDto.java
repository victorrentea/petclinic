package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners matching a search.")
public record OwnerPageDto(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "The owners on the requested page, with their pets and visits.") List<OwnerDto> content,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "26",
                description = "How many owners match the search, across all pages.") long totalElements) {
}
