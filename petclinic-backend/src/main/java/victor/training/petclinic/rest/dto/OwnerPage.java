package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.Data;

@Data
@Schema(name = "OwnerPage", description = "Spring-style paged response containing owner rows.")
public class OwnerPage {
    private List<OwnerDto> content;
    private PageableDetails pageable;
    private boolean last;
    private int totalPages;
    private long totalElements;
    private int size;
    private int number;
    private SortDetails sort;
    private boolean first;
    private int numberOfElements;
    private boolean empty;
}
