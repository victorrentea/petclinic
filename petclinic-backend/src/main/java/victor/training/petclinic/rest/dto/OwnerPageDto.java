package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners, in the order asked for.")
public class OwnerPageDto {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The owners on this page, each with their pets.")
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "0", description = "The 0-based index of this page.")
    private int page;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "10", description = "The page size asked for.")
    private int size;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "42",
            description = "How many owners match the filter, across all pages.")
    private long totalElements;

    public List<OwnerDto> getContent() {
        return content;
    }

    public OwnerPageDto setContent(List<OwnerDto> content) {
        this.content = content;
        return this;
    }

    public int getPage() {
        return page;
    }

    public OwnerPageDto setPage(int page) {
        this.page = page;
        return this;
    }

    public int getSize() {
        return size;
    }

    public OwnerPageDto setSize(int size) {
        this.size = size;
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
