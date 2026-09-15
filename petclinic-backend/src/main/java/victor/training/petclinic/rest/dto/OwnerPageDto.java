package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * The `GET /api/owners` response shape: only the five fields clients rely on, not Spring's
 * full {@code Page} JSON (which also carries {@code pageable}, {@code sort}, {@code first},
 * {@code last}, {@code empty}...). A plain {@code Page<OwnerListItemDto>} return type also
 * left springdoc unable to generate a schema for the response at all, since {@code Page} is
 * an interface it can't introspect.
 */
public class OwnerPageDto {
    @Schema(description = "The owners on this page.")
    private List<OwnerListItemDto> content;

    @Schema(example = "28", description = "Total number of owners matching the filter, across all pages.")
    private long totalElements;

    @Schema(example = "3", description = "Total number of pages.")
    private int totalPages;

    @Schema(example = "0", description = "0-based index of this page.")
    private int number;

    @Schema(example = "10", description = "Number of owners requested per page.")
    private int size;

    public OwnerPageDto() {
    }

    public OwnerPageDto(List<OwnerListItemDto> content, long totalElements, int totalPages, int number, int size) {
        this.content = content;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.number = number;
        this.size = size;
    }

    public List<OwnerListItemDto> getContent() {
        return content;
    }

    public void setContent(List<OwnerListItemDto> content) {
        this.content = content;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public void setTotalElements(long totalElements) {
        this.totalElements = totalElements;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public int getNumber() {
        return number;
    }

    public void setNumber(int number) {
        this.number = number;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }
}
