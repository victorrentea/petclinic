package org.springframework.samples.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ReviewFieldsDto {

    @NotNull
    @Min(1)
    @Max(5)
    @Schema(example = "5", description = "Star rating between 1 and 5.", requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer rating;

    @Size(max = 500)
    @Schema(example = "Excellent care for my pet!", 
            description = "Optional text feedback, max 500 characters.")
    private String feedback;
}
