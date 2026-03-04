import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Review } from '../review.model';
import { Vet } from '../vet';
import { ReviewService } from '../review.service';
import { VetService } from '../vet.service';

/**
 * Component for displaying all reviews for a veterinarian on a dedicated page.
 * Shows veterinarian info header, complete list of reviews with full text, star ratings, and timestamps.
 * 
 * Requirements: 2.6, 2.7, 2.8, 2.9, 5.1, 5.2, 6.4
 */
@Component({
  selector: 'app-vet-review-details',
  templateUrl: './vet-review-details.component.html',
  styleUrls: ['./vet-review-details.component.css']
})
export class VetReviewDetailsComponent implements OnInit {
  vetId: number;
  vet: Vet | null = null;
  reviews: Review[] = [];
  isLoading: boolean = true;
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reviewService: ReviewService,
    private vetService: VetService,
    private domSanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Get vetId from route parameter
    this.route.params.subscribe(params => {
      this.vetId = +params['id'];
      if (this.vetId) {
        this.loadVetDetails();
        this.loadReviews();
      } else {
        this.errorMessage = 'Invalid veterinarian ID';
        this.isLoading = false;
      }
    });
  }

  /**
   * Loads the veterinarian details from the backend.
   */
  private loadVetDetails(): void {
    this.vetService.getVetById(this.vetId.toString()).subscribe({
      next: (vet: Vet) => {
        this.vet = vet;
      },
      error: (error) => {
        console.error('Error loading veterinarian details:', error);
        this.errorMessage = 'Unable to load veterinarian details';
      }
    });
  }

  /**
   * Fetches all reviews for the veterinarian from the backend.
   * Reviews are already sorted by the backend in reverse chronological order.
   */
  loadReviews(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.reviewService.getReviewsByVetId(this.vetId).subscribe({
      next: (reviews: Review[]) => {
        // Backend returns reviews already sorted in reverse chronological order
        this.reviews = this.sortReviewsByDate(reviews);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading reviews:', error);
        this.errorMessage = 'Unable to load reviews. Please try again later';
        this.isLoading = false;
      }
    });
  }

  /**
   * Sorts reviews by creation date in reverse chronological order (most recent first).
   * This ensures client-side sorting matches backend expectations.
   * 
   * @param reviews - Array of reviews to sort
   * @returns Sorted array with most recent reviews first
   */
  sortReviewsByDate(reviews: Review[]): Review[] {
    return reviews.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Descending order (most recent first)
    });
  }

  /**
   * Converts a numeric rating to an array of star representations.
   * @param rating - The numeric rating (1-5)
   * @returns Array of strings representing filled and empty stars
   */
  renderStars(rating: number): string[] {
    const stars: string[] = [];
    const fullStars = Math.floor(rating);
    
    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push('★');
    }
    
    // Add empty stars to reach 5 total
    const remainingStars = 5 - fullStars;
    for (let i = 0; i < remainingStars; i++) {
      stars.push('☆');
    }
    
    return stars;
  }

  /**
   * Sanitizes feedback text for safe display as plain text.
   * Uses Angular's DomSanitizer to prevent XSS attacks.
   * 
   * @param feedback - The feedback text to sanitize
   * @returns Sanitized text safe for display
   */
  sanitizeFeedback(feedback: string): string {
    if (!feedback) {
      return '';
    }
    // Return as plain text - no HTML rendering
    return feedback;
  }

  /**
   * Formats a date for display.
   * @param date - The date to format
   * @returns Formatted date string
   */
  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Navigates back to the veterinarians list.
   */
  goBack(): void {
    this.router.navigate(['/vets']);
  }

  /**
   * Returns true if there are reviews to display.
   */
  get hasReviews(): boolean {
    return this.reviews && this.reviews.length > 0;
  }

  /**
   * Returns the veterinarian's full name.
   */
  get vetName(): string {
    if (!this.vet) {
      return 'Veterinarian';
    }
    return `${this.vet.firstName} ${this.vet.lastName}`;
  }

  /**
   * Returns a comma-separated list of specialty names.
   */
  get specialtyNames(): string {
    if (!this.vet || !this.vet.specialties || this.vet.specialties.length === 0) {
      return 'None';
    }
    return this.vet.specialties.map(s => s.name).join(', ');
  }
}
