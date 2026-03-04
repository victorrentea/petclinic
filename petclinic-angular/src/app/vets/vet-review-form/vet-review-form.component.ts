import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Review, ReviewSubmission } from '../review.model';
import { ReviewService } from '../review.service';
import { SanitizationService } from '../sanitization.service';

/**
 * Component for submitting new veterinarian reviews.
 * Provides a form with star rating selector, feedback textarea, and validation.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 3.2, 4.1, 4.2, 4.3, 4.4
 */
@Component({
  selector: 'app-vet-review-form',
  templateUrl: './vet-review-form.component.html',
  styleUrls: ['./vet-review-form.component.css']
})
export class VetReviewFormComponent implements OnInit {
  @Input() vetId: number;
  @Output() reviewSubmitted = new EventEmitter<Review>();

  rating: number = 0;
  feedback: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  isSubmitting: boolean = false;

  readonly MAX_FEEDBACK_LENGTH = 500;
  readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private reviewService: ReviewService,
    private sanitizationService: SanitizationService
  ) {}

  ngOnInit(): void {
    // Initialize component
  }

  /**
   * Sets the rating when a star is clicked.
   * @param rating - The star rating (1-5)
   */
  setRating(rating: number): void {
    this.rating = rating;
    this.errorMessage = '';
  }

  /**
   * Returns the character count for the feedback textarea.
   */
  get characterCount(): number {
    return this.feedback ? this.feedback.length : 0;
  }

  /**
   * Returns true if the character count exceeds the maximum.
   */
  get isOverLimit(): boolean {
    return this.characterCount > this.MAX_FEEDBACK_LENGTH;
  }

  /**
   * Validates that the rating is between 1 and 5.
   * @param rating - The rating to validate
   * @returns true if valid, false otherwise
   */
  validateRating(rating: number): boolean {
    return Number.isInteger(rating) && rating >= 1 && rating <= 5;
  }

  /**
   * Validates that the feedback is 500 characters or less.
   * @param feedback - The feedback text to validate
   * @returns true if valid, false otherwise
   */
  validateFeedback(feedback: string): boolean {
    return !feedback || feedback.length <= this.MAX_FEEDBACK_LENGTH;
  }

  /**
   * Submits the review after validation and sanitization.
   */
  submitReview(): void {
    this.errorMessage = '';
    this.successMessage = '';

    // Validate rating
    if (!this.validateRating(this.rating)) {
      this.errorMessage = 'Rating must be between 1 and 5 stars';
      return;
    }

    // Validate feedback length
    if (!this.validateFeedback(this.feedback)) {
      this.errorMessage = `Feedback must be ${this.MAX_FEEDBACK_LENGTH} characters or less (currently: ${this.characterCount} characters)`;
      return;
    }

    // Validate veterinarian ID
    if (!this.vetId) {
      this.errorMessage = 'Unable to submit review: veterinarian not specified';
      return;
    }

    // Sanitize feedback
    let sanitizedFeedback = this.feedback;
    try {
      if (this.feedback) {
        sanitizedFeedback = this.sanitizationService.sanitizeFeedback(this.feedback);
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Invalid feedback content';
      return;
    }

    // Create submission
    const submission: ReviewSubmission = {
      vetId: this.vetId,
      rating: this.rating,
      feedback: sanitizedFeedback
    };

    // Submit to backend
    this.isSubmitting = true;
    this.reviewService.submitReview(submission).subscribe({
      next: (review: Review) => {
        this.isSubmitting = false;
        this.successMessage = 'Review submitted successfully!';
        this.reviewSubmitted.emit(review);
        this.resetForm();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.errorMessage = this.getErrorMessage(error);
      }
    });
  }

  /**
   * Cancels the form and resets all fields.
   */
  cancel(): void {
    this.resetForm();
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Resets the form to initial state.
   */
  private resetForm(): void {
    this.rating = 0;
    this.feedback = '';
  }

  /**
   * Extracts a user-friendly error message from the error response.
   */
  private getErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      return error.message;
    }
    return 'An error occurred while submitting your review. Please try again later';
  }
}
