package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.ArrayList;
import java.util.List;

@Schema(description = "One page of owners; the totals describe the whole filtered result.")
public class OwnerPageDto {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The owners on this page, in sort order.")
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "23",
            description = "How many owners match the filter, across all pages.")
    private long totalElements;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "3",
            description = "How many pages the matching owners fill at this page size.")
    private int totalPages;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "0", description = "Zero-based page number.")
    private int number;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "10", description = "Requested page size.")
    private int size;

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

    public int getTotalPages() {
        return totalPages;
    }

    public OwnerPageDto setTotalPages(int totalPages) {
        this.totalPages = totalPages;
        return this;
    }

    public int getNumber() {
        return number;
    }

    public OwnerPageDto setNumber(int number) {
        this.number = number;
        return this;
    }

    public int getSize() {
        return size;
    }

    public OwnerPageDto setSize(int size) {
        this.size = size;
        return this;
    }
}
