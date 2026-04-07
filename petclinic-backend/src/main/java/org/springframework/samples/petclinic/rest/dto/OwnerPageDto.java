package org.springframework.samples.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import lombok.Data;

@Data
public class OwnerPageDto {

    @Valid
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(example = "0", description = "Current page number (0-based).")
    private Integer number;

    @Schema(example = "20", description = "Current page size.")
    private Integer size;

    @Schema(example = "42", description = "Total number of matching owners.")
    private Long totalElements;

    @Schema(example = "3", description = "Total number of pages.")
    private Integer totalPages;
}
