package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

/** Our own page shape, not Spring's PageImpl JSON, which is no stable contract. */
@Schema(description = "One page of owners, with the totals of the whole matching list.")
public record OwnerPageDto(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<OwnerListItemDto> content,
        @Schema(example = "27", requiredMode = Schema.RequiredMode.REQUIRED) long totalElements,
        @Schema(example = "3", requiredMode = Schema.RequiredMode.REQUIRED) int totalPages,
        @Schema(example = "0", description = "Zero-based page number.",
                requiredMode = Schema.RequiredMode.REQUIRED) int number,
        @Schema(example = "10", requiredMode = Schema.RequiredMode.REQUIRED) int size) {

    public static OwnerPageDto of(Page<OwnerListItemDto> page) {
        return new OwnerPageDto(page.getContent(), page.getTotalElements(), page.getTotalPages(),
                page.getNumber(), page.getSize());
    }
}
