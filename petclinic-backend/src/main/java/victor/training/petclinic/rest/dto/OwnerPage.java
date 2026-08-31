package victor.training.petclinic.rest.dto;

import org.springframework.data.domain.Page;
import org.springframework.data.web.PagedModel;

/**
 * The response shape of {@code GET /api/owners}: {@code {content:[...], page:{size, number,
 * totalElements, totalPages}}}.
 *
 * <p>Exists only so the contract can name it. springdoc derives a schema from the controller's
 * {@code PagedModel<OwnerDto>} return type, but only when the operation carries no explicit
 * {@code @ApiResponse} content — and that annotation is where {@link
 * victor.training.petclinic.rest.ApiExamples#OWNERS} attaches. Binding the generic to a concrete
 * class lets the operation declare both its schema and its example. Nothing constructs it: the
 * controller keeps returning {@code PagedModel<OwnerDto>}.
 */
public class OwnerPage extends PagedModel<OwnerDto> {
    public OwnerPage(Page<OwnerDto> page) {
        super(page);
    }
}
