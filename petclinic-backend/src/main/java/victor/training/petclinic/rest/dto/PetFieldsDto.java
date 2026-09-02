package victor.training.petclinic.rest.dto;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public class PetFieldsDto {

    @NotNull
    @Size(max = 30)
    @Schema(example = "Leo", description = "The name of the pet.")
    private String name;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    @NotNull
    @Valid
    @Schema(example = "2010-09-07", description = "The date of birth of the pet.")
    @PastOrPresent(message = "Birth date must not be in the future")
    private LocalDate birthDate;

    @NotNull
    @Valid
    @Schema
    private PetTypeDto type;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }

    public PetTypeDto getType() {
        return type;
    }

    public void setType(PetTypeDto type) {
        this.type = type;
    }
}
