package victor.training.petclinic.rest.dto;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners, in the requested order.")
public record OwnerPageDto(
        @Schema(requiredMode = REQUIRED,
                description = "The owners on this page; empty past the last page.") List<OwnerDto> content,
        @Schema(requiredMode = REQUIRED, example = "26",
                description = "How many owners match the last-name filter, across all pages.") long totalElements) {
}
