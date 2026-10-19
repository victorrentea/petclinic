package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record OwnerPageDto(
        @Schema(description = "The owners on this page") List<OwnerDto> content,
        @Schema(description = "How many owners match the filter, on all pages", example = "28") long totalElements) {
}
