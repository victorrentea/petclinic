package org.springframework.samples.petclinic.rest.dto;

import java.util.Objects;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonTypeName;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class PetTypeFieldsDto {
    @NotNull @Size(min = 1, max = 80)
    @Schema(example = "cat", description = "The name of the pet type.")
    private String name;
}
