package org.springframework.samples.petclinic.service;

import lombok.RequiredArgsConstructor;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Service;
import org.springframework.samples.petclinic.mapper.ReviewMapper;
import org.springframework.samples.petclinic.model.Review;
import org.springframework.samples.petclinic.repository.ReviewRepository;
import org.springframework.samples.petclinic.rest.dto.ReviewStatsDto;

import java.util.List;

/**
 * Service for managing veterinarian reviews with XSS protection.
 */
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ReviewMapper reviewMapper;

    // OWASP HTML Sanitizer configured to strip all HTML tags (plain text only policy)
    private static final PolicyFactory PLAIN_TEXT_ONLY = new HtmlPolicyBuilder().toFactory();

    /**
     * Sanitizes feedback text using OWASP HTML Sanitizer to remove all HTML tags.
     * This provides XSS protection by stripping any potentially malicious content.
     *
     * @param feedback the raw feedback text from user input
     * @return sanitized plain text with all HTML tags removed
     */
    public String sanitizeFeedback(String feedback) {
        if (feedback == null || feedback.isEmpty()) {
            return feedback;
        }

        // Use OWASP HTML Sanitizer to strip all HTML tags and prevent XSS
        // This library is battle-tested and maintained by security experts
        String sanitized = PLAIN_TEXT_ONLY.sanitize(feedback);

        // Trim whitespace that may result from tag removal
        return sanitized.trim();
    }

    /**
     * Sanitizes the review feedback and saves it to the database.
     *
     * @param review the review to sanitize and save
     * @return the saved review with sanitized feedback
     */
    public Review sanitizeAndSave(Review review) {
        if (review.getFeedback() != null) {
            String sanitized = sanitizeFeedback(review.getFeedback());
            review.setFeedback(sanitized);
        }
        reviewRepository.save(review);
        return review;
    }

    /**
     * Retrieves all reviews for a specific veterinarian, sorted by creation date (most recent first).
     *
     * @param vetId the ID of the veterinarian
     * @return list of reviews sorted by createdAt descending
     */
    public List<Review> getReviewsByVetId(int vetId) {
        return reviewRepository.findByVetIdOrderByCreatedAtDesc(vetId);
    }

    /**
     * Calculates and retrieves aggregated review statistics for a veterinarian.
     *
     * @param vetId the ID of the veterinarian
     * @return review statistics including average rating and total count
     */
    public ReviewStatsDto getReviewStats(int vetId) {
        Double avgRating = reviewRepository.findAverageRatingByVetId(vetId);
        Long totalReviews = reviewRepository.countByVetId(vetId);

        ReviewStatsDto stats = new ReviewStatsDto();
        stats.setVetId(vetId);
        // Handle null values from aggregate queries when no reviews exist
        stats.setAverageRating(avgRating != null ? Math.round(avgRating * 10.0) / 10.0 : 0.0);
        stats.setTotalReviews(totalReviews != null ? totalReviews.intValue() : 0);

        return stats;
    }

    /**
     * Deletes a review from the database.
     *
     * @param review the review to delete
     */
    public void deleteReview(Review review) {
        reviewRepository.delete(review);
    }


    /**
     * Retrieves aggregated review statistics for all veterinarians in a single query.
     * This is more efficient than calling getReviewStats() for each vet individually.
     *
     * @return map of vet ID to review statistics
     */
    public java.util.Map<Integer, ReviewStatsDto> getAllReviewStats() {
        // Get all vets with reviews
        List<Object[]> results = reviewRepository.findAllReviewStats();

        java.util.Map<Integer, ReviewStatsDto> statsMap = new java.util.HashMap<>();

        for (Object[] result : results) {
            Integer vetId = (Integer) result[0];
            Double avgRating = (Double) result[1];
            Long totalReviews = (Long) result[2];

            ReviewStatsDto stats = new ReviewStatsDto();
            stats.setVetId(vetId);
            stats.setAverageRating(avgRating != null ? Math.round(avgRating * 10.0) / 10.0 : 0.0);
            stats.setTotalReviews(totalReviews != null ? totalReviews.intValue() : 0);

            statsMap.put(vetId, stats);
        }

        return statsMap;
    }

}
