package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;
import org.springframework.data.web.PagedModel;

/** Named only so the contract has a concrete schema: springdoc can't reference a generic one by hand. */
@Schema(description = "One page of the visits grid.")
public class VisitPageDto extends PagedModel<VisitRowDto> {
    public VisitPageDto(Page<VisitRowDto> page) {
        super(page);
    }
}
