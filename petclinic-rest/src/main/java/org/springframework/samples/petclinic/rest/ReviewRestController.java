package org.springframework.samples.petclinic.rest;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.mapper.ReviewMapper;
import org.springframework.samples.petclinic.model.Review;
import org.springframework.samples.petclinic.model.Vet;
import org.springframework.samples.petclinic.repository.VetRepository;
import org.springframework.samples.petclinic.rest.dto.ReviewDto;
import org.springframework.samples.petclinic.rest.dto.ReviewFieldsDto;
import org.springframework.samples.petclinic.rest.dto.ReviewStatsDto;
import org.springframework.samples.petclinic.service.ReviewService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/vets/{vetId}/reviews")
@RequiredArgsConstructor
public class ReviewRestController {

    private final ReviewMapper reviewMapper;
    private final ReviewService reviewService;
    private final VetRepository vetRepository;

    @GetMapping
    public List<ReviewDto> getReviewsByVetId(@PathVariable int vetId) {
        List<Review> reviews = reviewService.getReviewsByVetId(vetId);
        return reviewMapper.toReviewDtos(reviews);
    }

    @GetMapping("/stats")
    public ReviewStatsDto getReviewStats(@PathVariable int vetId) {
        return reviewService.getReviewStats(vetId);
    }

    @PostMapping
    public ResponseEntity<ReviewDto> addReview(
            @PathVariable int vetId,
            @RequestBody @Validated ReviewFieldsDto reviewFieldsDto) {
        
        Vet vet = vetRepository.findById(vetId)
            .orElseThrow(() -> new IllegalArgumentException("Veterinarian not found"));
        
        Review review = reviewMapper.toReview(reviewFieldsDto);
        review.setVet(vet);
        
        Review savedReview = reviewService.sanitizeAndSave(review);
        ReviewDto reviewDto = reviewMapper.toReviewDto(savedReview);
        
        URI createdReviewUri = UriComponentsBuilder
            .fromPath("/api/vets/{vetId}/reviews/{id}")
            .buildAndExpand(vetId, savedReview.getId())
            .toUri();
        
        return ResponseEntity.created(createdReviewUri).body(reviewDto);
    }

    @Transactional
    @DeleteMapping("/{reviewId}")
    public ResponseEntity<Void> deleteReview(
            @PathVariable int vetId,
            @PathVariable int reviewId) {
        
        Review review = reviewService.getReviewsByVetId(vetId).stream()
            .filter(r -> r.getId().equals(reviewId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Review not found"));
        
        reviewService.deleteReview(review);
        return ResponseEntity.noContent().build();
    }
}

/**
 * REST controller for bulk review operations.
 */
@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
class BulkReviewRestController {

    private final ReviewService reviewService;

    @GetMapping("/stats")
    public java.util.Map<Integer, ReviewStatsDto> getAllReviewStats() {
        return reviewService.getAllReviewStats();
    }
}
