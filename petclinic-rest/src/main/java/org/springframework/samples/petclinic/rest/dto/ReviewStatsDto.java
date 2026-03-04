package org.springframework.samples.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class ReviewStatsDto {

    @Schema(example = "1", description = "The ID of the veterinarian.")
    private Integer vetId;

    @Schema(example = "4.5", description = "Average rating rounded to one decimal place.")
    private Double averageRating;

    @Schema(example = "10", description = "Total number of reviews.")
    private Integer totalReviews;
}
