package org.springframework.samples.petclinic.rest.dto;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class PetFieldsDto {

    @NotNull
    @Size(max = 30)
    @Schema(example = "Leo", description = "The name of the pet.")
    private String name;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    @NotNull
    @Valid
    @Schema(example = "2010-09-07", description = "The date of birth of the pet.")
    @PastOrPresent(message = "{pet.birthDate.notInFuture}")
    private LocalDate birthDate;

    @NotNull
    @Valid
    @Schema
    private PetTypeDto type;
}
