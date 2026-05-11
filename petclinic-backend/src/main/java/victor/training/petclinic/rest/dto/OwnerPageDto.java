package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "A single page of owner search results.")
public class OwnerPageDto {
    @Schema(description = "The owners on this page.")
    private List<OwnerDto> content;

    @Schema(description = "Total number of owners matching the search criteria across all pages.", example = "42")
    private long totalElements;
}
