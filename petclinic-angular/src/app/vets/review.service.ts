import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { HandleError, HttpErrorHandler } from '../error.service';
import { Review, ReviewSubmission, ReviewStats } from './review.model';

/**
 * Service for managing veterinarian reviews via HTTP API.
 * Handles CRUD operations for reviews and retrieves review statistics.
 */
@Injectable()
export class ReviewService {
  private readonly handlerError: HandleError;

  constructor(
    private http: HttpClient,
    private httpErrorHandler: HttpErrorHandler
  ) {
    this.handlerError = httpErrorHandler.createHandleError('ReviewService');
  }

  /**
   * Retrieves all reviews for a specific veterinarian.
   * Reviews are returned in reverse chronological order (most recent first).
   *
   * @param vetId - The ID of the veterinarian
   * @returns Observable of Review array
   */
  getReviewsByVetId(vetId: number): Observable<Review[]> {
    const url = `${environment.REST_API_URL}vets/${vetId}/reviews`;
    return this.http
      .get<Review[]>(url)
      .pipe(catchError(this.handlerError('getReviewsByVetId', [])));
  }

  /**
   * Retrieves aggregated statistics for a veterinarian's reviews.
   * Includes average rating, total count, and most recent review.
   *
   * @param vetId - The ID of the veterinarian
   * @returns Observable of ReviewStats
   */
  getReviewStats(vetId: number): Observable<ReviewStats> {
    const url = `${environment.REST_API_URL}vets/${vetId}/reviews/stats`;
    const emptyStats: ReviewStats = {
      vetId,
      averageRating: 0,
      totalReviews: 0
    };
    return this.http
      .get<ReviewStats>(url)
      .pipe(catchError(this.handlerError('getReviewStats', emptyStats)));
  }

  /**
   * Submits a new review for a veterinarian.
   * The review will be sanitized on the backend before storage.
   *
   * @param submission - The review data to submit
   * @returns Observable of the created Review with ID and timestamp
   */
  submitReview(submission: ReviewSubmission): Observable<Review> {
    const url = `${environment.REST_API_URL}vets/${submission.vetId}/reviews`;
    return this.http
      .post<Review>(url, {
        rating: submission.rating,
        feedback: submission.feedback
      })
      .pipe(catchError(this.handlerError('submitReview', {} as Review)));
  }

  /**
   * Deletes a review by ID.
   * This operation is typically restricted to administrators.
   *
   * @param reviewId - The ID of the review to delete
   * @returns Observable of void
   */
  deleteReview(reviewId: number): Observable<void> {
    const url = `${environment.REST_API_URL}reviews/${reviewId}`;
    return this.http
      .delete<void>(url)
      .pipe(catchError(this.handlerError('deleteReview', undefined)));
  }

  /**
   * Retrieves aggregated statistics for all veterinarians' reviews in a single request.
   * This is more efficient than calling getReviewStats() for each vet individually.
   *
   * @returns Observable of a map from vet ID to ReviewStats
   */
  getAllReviewStats(): Observable<{ [vetId: number]: ReviewStats }> {
    const url = `${environment.REST_API_URL}reviews/stats`;
    return this.http
      .get<{ [vetId: number]: ReviewStats }>(url)
      .pipe(catchError(this.handlerError('getAllReviewStats', {})));
  }
}
