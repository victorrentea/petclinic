package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

@Schema(description = "One page of the visits grid, with the paging and sorting actually applied.")
public record VisitPageDto(
        @Schema(requiredMode = REQUIRED, description = "The visits on this page.") List<VisitRowDto> content,
        @Schema(requiredMode = REQUIRED, example = "0", description = "The page served, 0-based.") int page,
        @Schema(requiredMode = REQUIRED, example = "10", description = "Rows per page: 5, 10 or 20.") int size,
        @Schema(requiredMode = REQUIRED, example = "42",
                description = "Visits in the clinic, on all pages.") long totalElements,
        @Schema(requiredMode = REQUIRED, example = "5", description = "Number of pages.") int totalPages,
        @Schema(requiredMode = REQUIRED, example = "date,desc",
                description = "The sort applied: date, description, pet or owner, then asc or desc.") String sort) {

    public static VisitPageDto of(Page<VisitRowDto> page, String sort) {
        return new VisitPageDto(page.getContent(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), sort);
    }
}
