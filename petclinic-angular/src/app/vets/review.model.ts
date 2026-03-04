/**
 * Review data model interfaces for the veterinarian review feature.
 * These interfaces match the backend DTOs for type safety.
 */

/**
 * Represents a complete review with all fields including ID and timestamp.
 * Used when retrieving reviews from the backend.
 */
export interface Review {
  id: number;
  vetId: number;
  rating: number;        // 1-5 star rating
  feedback: string;      // Max 500 characters, sanitized
  createdAt: Date;       // Timestamp for sorting
}

/**
 * Represents the data needed to submit a new review.
 * Used when creating a review (no ID or timestamp needed).
 */
export interface ReviewSubmission {
  vetId: number;
  rating: number;        // 1-5 star rating
  feedback: string;      // Max 500 characters
}

/**
 * Represents aggregated statistics for a veterinarian's reviews.
 * Used to display summary information in the vet list.
 */
export interface ReviewStats {
  vetId: number;
  averageRating: number;
  totalReviews: number;
}
