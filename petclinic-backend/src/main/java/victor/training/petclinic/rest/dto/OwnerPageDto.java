package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners, with the totals the paginator needs.")
public record OwnerPageDto(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "The owners on this page.") List<OwnerDto> content,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "27",
                description = "How many owners match, on all pages.") long totalElements,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "3") int totalPages,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "0",
                description = "This page's index, from 0.") int number,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "10",
                description = "The requested page size.") int size) {
}
