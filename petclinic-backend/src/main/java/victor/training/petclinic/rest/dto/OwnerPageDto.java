package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.ArrayList;
import java.util.List;

@Schema(description = "One page of owners, and how many match across all pages.")
public class OwnerPageDto {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The owners on this page.")
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "0", description = "0-based page number.")
    private int page;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "10", description = "Page size: 5, 10 or 20.")
    private int size;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "26",
            description = "Owners matching the filter, across all pages.")
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
