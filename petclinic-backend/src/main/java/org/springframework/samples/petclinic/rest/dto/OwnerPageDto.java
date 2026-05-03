package org.springframework.samples.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record OwnerPageDto(
    @Schema(description = "The owners on the requested page.")
    List<OwnerDto> content,
    @Schema(example = "10", description = "The total number of owners that match the current query.")
    long totalElements,
    @Schema(example = "1", description = "The total number of pages for the current query and page size.")
    int totalPages,
    @Schema(example = "0", description = "The zero-based page index of the returned content.")
    int number,
    @Schema(example = "10", description = "The requested page size.")
    int size
) {
}
