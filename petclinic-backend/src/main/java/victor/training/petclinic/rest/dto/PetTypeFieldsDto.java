package victor.training.petclinic.rest.dto;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public class PetTypeFieldsDto {
    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "cat", description = "The name of the pet type.")
    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
