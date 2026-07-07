package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import lombok.Data;

@Data
public class OwnersPageDto {
    private int page;
    private int pageSize;
    private long totalItems;
    private int totalPages;
    private String lastName;
    private OwnerSortDto sort;
    private List<OwnerDto> items = new ArrayList<>();
}
