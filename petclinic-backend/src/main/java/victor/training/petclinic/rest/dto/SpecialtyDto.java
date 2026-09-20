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

    public SpecialtyDto setId(Integer id) {
        this.id = id;
        return this;
    }

    public String getName() {
        return name;
    }

    public SpecialtyDto setName(String name) {
        this.name = name;
        return this;
    }

    public String getDescription() {
        return description;
    }

    public SpecialtyDto setDescription(String description) {
        this.description = description;
        return this;
    }
}
