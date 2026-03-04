package org.springframework.samples.petclinic.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.springframework.samples.petclinic.model.Review;
import org.springframework.samples.petclinic.rest.dto.ReviewDto;
import org.springframework.samples.petclinic.rest.dto.ReviewFieldsDto;

import java.util.List;

@Mapper(componentModel = "spring")
public interface ReviewMapper {

    @Mapping(source = "vet.id", target = "vetId")
    ReviewDto toReviewDto(Review review);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "vet", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    Review toReview(ReviewFieldsDto reviewFieldsDto);

    List<ReviewDto> toReviewDtos(List<Review> reviews);
}
