package victor.training.petclinic.rest.dto;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

public class SpecialtyDto {

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the specialty.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer id;

    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "radiology", description = "The name of the specialty.")
    private String name;

    @Size(max = 4000)
    @Schema(example = "limping, broken bone, swollen leg, can't bear weight",
            description = "The section that identifies this specialty (symptoms); vectorized into the chatbot RAG.")
    private String description;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
