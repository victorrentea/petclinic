package victor.training.petclinic.rest.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class OwnerPageDto {
    private List<OwnerDto> content = new ArrayList<>();
    private long totalElements;
    private int totalPages;
    private int number;
    private int size;
}
