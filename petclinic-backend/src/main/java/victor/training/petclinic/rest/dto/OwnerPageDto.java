package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/** One page of owners: {@code number} counts from 0, the totals count every owner matching the search. */
public class OwnerPageDto {

    @Schema(description = "The owners on this page.")
    private List<OwnerDto> content;

    @Schema(example = "28", description = "How many owners match, across all pages.")
    private long totalElements;

    @Schema(example = "3", description = "How many pages there are.")
    private int totalPages;

    @Schema(example = "0", description = "The number of this page, from 0.")
    private int number;

    @Schema(example = "10", description = "The requested page size.")
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
