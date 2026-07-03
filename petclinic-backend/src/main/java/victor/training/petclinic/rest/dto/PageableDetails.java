package victor.training.petclinic.rest.dto;

import lombok.Data;

@Data
public class PageableDetails {
    private int pageNumber;
    private int pageSize;
    private SortDetails sort;
    private long offset;
    private boolean paged;
    private boolean unpaged;
}
