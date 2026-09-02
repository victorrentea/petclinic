package victor.training.petclinic.rest.dto;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public class PetTypeDto {

    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "cat", description = "The name of the pet type.")
    private String name;

    @NotNull
    @Min(0)
    @Schema(example = "1", description = "The ID of the pet type.")
    private Integer id;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }
}
