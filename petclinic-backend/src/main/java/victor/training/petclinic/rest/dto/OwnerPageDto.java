package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * One page of the owners grid. Hand-written (not Spring's {@code Page}/{@code PagedModel}) so the
 * JSON shape stays stable across Spring versions and never leaks {@code pageable}/{@code sort}
 * internals into {@code openapi.yaml}.
 */
public class OwnerPageDto {
    @Schema(description = "Owners on this page.", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(description = "Number of owners matching the filter, across every page.",
            requiredMode = Schema.RequiredMode.REQUIRED)
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
