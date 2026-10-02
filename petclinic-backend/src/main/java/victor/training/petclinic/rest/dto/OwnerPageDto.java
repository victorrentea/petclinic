package victor.training.petclinic.rest.dto;

import java.util.List;

public record OwnerPageDto(
        List<OwnerDto> content,
        long totalElements,
        int totalPages,
        int number,
        int size) {
}
