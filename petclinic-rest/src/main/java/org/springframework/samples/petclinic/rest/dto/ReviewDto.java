package org.springframework.samples.petclinic.rest.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ReviewDto {

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", 
            description = "The ID of the review.", requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer id;

    @NotNull
    @Min(0)
    @Schema(example = "1", description = "The ID of the veterinarian.")
    private Integer vetId;

    @NotNull
    @Min(1)
    @Max(5)
    @Schema(example = "5", description = "Star rating between 1 and 5.")
    private Integer rating;

    @Size(max = 500)
    @Schema(example = "Excellent care for my pet!", 
            description = "Optional text feedback, max 500 characters.")
    private String feedback;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, 
            example = "2024-01-15T10:30:00", 
            description = "Timestamp when the review was created.")
    private LocalDateTime createdAt;
}
