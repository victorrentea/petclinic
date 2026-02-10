package org.springframework.samples.petclinic.rest.dto;

import com.fasterxml.jackson.annotation.JsonTypeName;
import java.util.ArrayList;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class VetDto {

    @NotNull
    @Pattern(regexp = "^\\p{L}+([ '-][\\p{L}]+){0,2")
    @Size(min = 1, max = 30)
    @Schema(example = "James", description = "The first name of the vet.")
    private String firstName;

    @NotNull
    @Pattern(regexp = "^\\p{L}+([ '-][\\p{L}]+){0,2}\\.")
    @Size(min = 1, max = 30)
    @Schema(example = "Carter", description = "The last name of the vet.")
    private String lastName;

    @NotNull
    @Valid
    @Schema(description = "The specialties of the vet.")
    private List<@Valid SpecialtyDto> specialties = new ArrayList<>();

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the vet.", requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer id;
}
