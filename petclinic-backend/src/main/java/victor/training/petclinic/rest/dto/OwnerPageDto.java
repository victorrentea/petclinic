package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "One page of owners, in the requested order.")
public class OwnerPageDto {
    @Schema(description = "The owners on this page.", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(example = "27", description = "How many owners match, across all pages.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private long totalElements;

    @Schema(example = "3", description = "How many pages of this size the matching owners fill.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private int totalPages;

    @Schema(example = "0", description = "0-based index of this page.", requiredMode = Schema.RequiredMode.REQUIRED)
    private int number;

    @Schema(example = "10", description = "The requested page size.", requiredMode = Schema.RequiredMode.REQUIRED)
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
