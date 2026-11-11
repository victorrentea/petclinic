package victor.training.petclinic.rest.dto;

import java.util.List;

import org.springframework.data.domain.Page;

import io.swagger.v3.oas.annotations.media.Schema;

/** One page of owners. Hand-written because serializing Spring's {@code PageImpl} is not a stable contract. */
public record OwnerPageDto(
        @Schema(description = "The owners on this page.",
                requiredMode = Schema.RequiredMode.REQUIRED) List<OwnerDto> content,
        @Schema(description = "How many owners match the filter, across all pages.", example = "26",
                requiredMode = Schema.RequiredMode.REQUIRED) long totalElements,
        @Schema(description = "How many pages of this size the matching owners fill.", example = "3",
                requiredMode = Schema.RequiredMode.REQUIRED) int totalPages,
        @Schema(description = "The zero-based number of this page.", example = "0",
                requiredMode = Schema.RequiredMode.REQUIRED) int number,
        @Schema(description = "The requested page size: 5, 10 or 20.", example = "10",
                requiredMode = Schema.RequiredMode.REQUIRED) int size) {

    public static OwnerPageDto from(Page<OwnerDto> page) {
        return new OwnerPageDto(page.getContent(), page.getTotalElements(), page.getTotalPages(),
                page.getNumber(), page.getSize());
    }
}
