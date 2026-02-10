package org.springframework.samples.petclinic.rest.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonTypeName;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class OwnerFieldsDto {

    @NotNull
    @Pattern(regexp = "^\\p{L}+([ '-]\\p{L}+){0,2}$")
    @Size(min = 1, max = 30)
    @Schema(example = "George", description = "The first name of the pet owner.")
    private String firstName;

    @NotNull
    @Pattern(regexp = "^\\p{L}+([ '-]\\p{L}+){0,2}\\.?$")
    @Size(min = 1, max = 30)
    @Schema(example = "Franklin", description = "The last name of the pet owner.")
    private String lastName;

    @NotNull
    @Size(min = 1, max = 255)
    @Schema(example = "110 W. Liberty St.", description = "The postal address of the pet owner.")
    private String address;

    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "Madison", description = "The city of the pet owner.")
    private String city;

    @NotNull
    @Pattern(regexp = "^[0-9]*$")
    @Size(min = 1, max = 20)
    @Schema(example = "6085551023", description = "The telephone number of the pet owner.")
    private String telephone;

}
