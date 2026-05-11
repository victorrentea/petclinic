package victor.training.petclinic.rest.dto;

import lombok.Data;

import java.util.List;

@Data
public class OwnerPageDto {
    private List<OwnerDto> content;
    private long totalElements;
}
