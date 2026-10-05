package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.ArrayList;
import java.util.List;

@Schema(description = "One page of owners, with the number of owners matching the filter across all pages.")
public class OwnerPageDto {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The owners on the requested page.")
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "29",
            description = "The number of owners matching the filter, across all pages.")
    private long totalElements;

    public List<OwnerDto> getContent() {

        return content;
    }

    public OwnerPageDto setContent(List<OwnerDto> content) {

        this.content = content;
        return this;
    }

    public long getTotalElements() {

        return totalElements;
    }

    public OwnerPageDto setTotalElements(long totalElements) {

        this.totalElements = totalElements;
        return this;
    }
}
