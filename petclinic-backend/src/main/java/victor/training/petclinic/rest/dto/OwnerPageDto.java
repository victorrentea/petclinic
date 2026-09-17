package victor.training.petclinic.rest.dto;

/**
 * Purely a documentation aid: Swagger/OpenAPI can't express a generic type parameter directly on
 * an {@code @Schema(implementation = ...)}, so this concrete subtype gives the owners list
 * endpoint's generated {@code openapi.yaml} schema a resolvable {@code content} item type. The
 * controller still returns (and Jackson still serializes) a plain {@code PageDto<OwnerDto>}.
 */
public class OwnerPageDto extends PageDto<OwnerDto> {
}
