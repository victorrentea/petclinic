package org.springframework.samples.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RoleDto {

    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "admin", description = "The role's name")
    private String name;

}
