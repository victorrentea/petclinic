package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A page of {@link OwnerListItemDto}, mirroring the shape of Spring Data's {@code Page} JSON
 * serialization. See {@code openspec/changes/add-owners-pagination}.
 */
@Schema(description = "A single page of the paginated, sorted owners list.")
public class OwnerPageDto {

    @Schema(description = "The owners on this page.")
    private List<OwnerListItemDto> content = new ArrayList<>();

    @Schema(example = "42", description = "Total number of owners matching the filter, across all pages.")
    private long totalElements;

    @Schema(example = "5", description = "Total number of pages.")
    private int totalPages;

    @Schema(example = "0", description = "The current page number (0-based).")
    private int number;

    @Schema(example = "10", description = "The number of elements per page.")
    private int size;

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
