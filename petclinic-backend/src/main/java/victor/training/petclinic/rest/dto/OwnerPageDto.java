package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners in the requested order.")
public record OwnerPageDto(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "The owners on this page; empty past the last page.") List<OwnerDto> content,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "26",
                description = "How many owners match the filter, across all pages.") long totalElements) {
}
