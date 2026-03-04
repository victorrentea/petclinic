import { Component, Input } from '@angular/core';
import { ReviewStats } from '../review.model';

/**
 * Component for displaying review summary in the veterinarian list.
 * Shows average rating with stars and "View Reviews" link.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.10, 5.1, 5.3, 5.4
 */
@Component({
  selector: 'app-vet-review-preview',
  templateUrl: './vet-review-preview.component.html',
  styleUrls: ['./vet-review-preview.component.css']
})
export class VetReviewPreviewComponent {
  @Input() vetId: number;
  @Input() reviewStats: ReviewStats;

  /**
   * Converts a numeric rating to an array of star representations.
   * @param rating - The numeric rating (1-5)
   * @returns Array of strings representing filled and empty stars
   */
  renderStars(rating: number): string[] {
    const stars: string[] = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push('★');
    }
    
    // Add half star if needed
    if (hasHalfStar && fullStars < 5) {
      stars.push('☆');
    }
    
    // Add empty stars to reach 5 total
    const remainingStars = 5 - stars.length;
    for (let i = 0; i < remainingStars; i++) {
      stars.push('☆');
    }
    
    return stars;
  }

  /**
   * Returns true if the veterinarian has reviews.
   */
  get hasReviews(): boolean {
    return !!(this.reviewStats && this.reviewStats.totalReviews > 0);
  }
}
