package org.springframework.samples.petclinic.rest.dto;

import com.fasterxml.jackson.annotation.JsonTypeName;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class PetTypeDto {

    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "cat", description = "The name of the pet type.")
    private String name;

    @NotNull
    @Min(0)
    @Schema(example = "1", description = "The ID of the pet type.")
    private Integer id;
}
