package victor.training.petclinic.rest.dto;

import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Hand-written page envelope for paginated list endpoints (see openapi.yaml guidance: DTOs are
 * hand-written, never generated). Deliberately not Spring Data's {@code Page}/{@code PageImpl}:
 * their JSON shape isn't a documented contract, so a stable one is written here instead.
 */
public class PageDto<T> {

    @Schema(description = "The elements on this page.")
    private List<T> content;

    @Schema(description = "Total number of elements across all pages.", example = "42")
    private long totalElements;

    @Schema(description = "Total number of pages.", example = "5")
    private int totalPages;

    @Schema(description = "0-based index of this page.", example = "0")
    private int number;

    @Schema(description = "Number of elements requested per page.", example = "10")
    private int size;

    public PageDto() {
    }

    public PageDto(List<T> content, long totalElements, int totalPages, int number, int size) {
        this.content = content;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.number = number;
        this.size = size;
    }

    public static <S, T> PageDto<T> from(Page<S> page, Function<S, T> mapper) {
        List<T> content = page.getContent().stream().map(mapper).collect(Collectors.toList());
        return new PageDto<>(content, page.getTotalElements(), page.getTotalPages(),
                page.getNumber(), page.getSize());
    }

    public List<T> getContent() {
        return content;
    }

    public void setContent(List<T> content) {
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
