package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
public class OwnerPageDto {

    @Schema(description = "The owners on this page.")
    private List<OwnerDto> content;

    @Schema(example = "42", description = "Total number of owners matching the filter (across all pages).")
    private long totalElements;

    @Schema(example = "0", description = "Zero-based index of this page.")
    private int page;

    @Schema(example = "10", description = "Number of owners requested per page.")
    private int size;

    @Schema(example = "5", description = "Total number of pages for the current filter.")
    private int totalPages;
}
