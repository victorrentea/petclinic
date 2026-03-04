import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { VetReviewPreviewComponent } from './vet-review-preview.component';
import { ReviewStats } from '../review.model';

describe('VetReviewPreviewComponent', () => {
  let component: VetReviewPreviewComponent;
  let fixture: ComponentFixture<VetReviewPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VetReviewPreviewComponent ],
      imports: [ RouterTestingModule ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VetReviewPreviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('truncateFeedback', () => {
    it('should return empty string for null or undefined text', () => {
      expect(component.truncateFeedback(null)).toBe('');
      expect(component.truncateFeedback(undefined)).toBe('');
    });

    it('should return original text if length is less than maxLength', () => {
      const text = 'Short feedback';
      expect(component.truncateFeedback(text, 100)).toBe(text);
    });

    it('should return original text if length equals maxLength', () => {
      const text = 'A'.repeat(100);
      expect(component.truncateFeedback(text, 100)).toBe(text);
    });

    it('should truncate text and add ellipsis if length exceeds maxLength', () => {
      const text = 'A'.repeat(101);
      const result = component.truncateFeedback(text, 100);
      expect(result).toBe('A'.repeat(100) + '...');
      expect(result.length).toBe(103); // 100 chars + '...'
    });

    it('should truncate at exactly 100 characters by default', () => {
      const text = 'This is a very long feedback text that exceeds one hundred characters and should be truncated with an ellipsis at the end';
      const result = component.truncateFeedback(text);
      expect(result.length).toBe(103); // 100 + '...'
      expect(result.endsWith('...')).toBe(true);
      expect(result.substring(0, 100)).toBe(text.substring(0, 100));
    });
  });

  describe('renderStars', () => {
    it('should render 5 full stars for rating 5', () => {
      const stars = component.renderStars(5);
      expect(stars).toEqual(['★', '★', '★', '★', '★']);
    });

    it('should render 1 full star and 4 empty stars for rating 1', () => {
      const stars = component.renderStars(1);
      expect(stars).toEqual(['★', '☆', '☆', '☆', '☆']);
    });

    it('should render 3 full stars and 2 empty stars for rating 3', () => {
      const stars = component.renderStars(3);
      expect(stars).toEqual(['★', '★', '★', '☆', '☆']);
    });

    it('should render half star for rating 4.5', () => {
      const stars = component.renderStars(4.5);
      expect(stars).toEqual(['★', '★', '★', '★', '☆']);
      expect(stars.length).toBe(5);
    });

    it('should render half star for rating 3.7', () => {
      const stars = component.renderStars(3.7);
      expect(stars).toEqual(['★', '★', '★', '☆', '☆']);
      expect(stars.length).toBe(5);
    });

    it('should not render half star for rating 3.4', () => {
      const stars = component.renderStars(3.4);
      expect(stars).toEqual(['★', '★', '★', '☆', '☆']);
      expect(stars.length).toBe(5);
    });

    it('should always return exactly 5 stars', () => {
      expect(component.renderStars(0).length).toBe(5);
      expect(component.renderStars(2.5).length).toBe(5);
      expect(component.renderStars(5).length).toBe(5);
    });
  });

  describe('hasReviews', () => {
    it('should return false when reviewStats is null', () => {
      component.reviewStats = null;
      expect(component.hasReviews).toBe(false);
    });

    it('should return false when totalReviews is 0', () => {
      component.reviewStats = {
        vetId: 1,
        averageRating: 0,
        totalReviews: 0,
        mostRecentReview: null
      };
      expect(component.hasReviews).toBe(false);
    });

    it('should return true when totalReviews is greater than 0', () => {
      component.reviewStats = {
        vetId: 1,
        averageRating: 4.5,
        totalReviews: 10,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: 'Great vet!',
          createdAt: new Date()
        }
      };
      expect(component.hasReviews).toBe(true);
    });
  });

  describe('truncatedFeedback', () => {
    it('should return empty string when no reviews exist', () => {
      component.reviewStats = {
        vetId: 1,
        averageRating: 0,
        totalReviews: 0,
        mostRecentReview: null
      };
      expect(component.truncatedFeedback).toBe('');
    });

    it('should return empty string when mostRecentReview has no feedback', () => {
      component.reviewStats = {
        vetId: 1,
        averageRating: 5,
        totalReviews: 1,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: '',
          createdAt: new Date()
        }
      };
      expect(component.truncatedFeedback).toBe('');
    });

    it('should return truncated feedback from most recent review', () => {
      const longFeedback = 'A'.repeat(150);
      component.reviewStats = {
        vetId: 1,
        averageRating: 5,
        totalReviews: 1,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: longFeedback,
          createdAt: new Date()
        }
      };
      expect(component.truncatedFeedback).toBe('A'.repeat(100) + '...');
    });
  });

  describe('template rendering', () => {
    it('should display "No reviews available" when no reviews exist', () => {
      component.vetId = 1;
      component.reviewStats = {
        vetId: 1,
        averageRating: 0,
        totalReviews: 0,
        mostRecentReview: null
      };
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('.no-reviews')).toBeTruthy();
      expect(compiled.textContent).toContain('No reviews available');
    });

    it('should display review content when reviews exist', () => {
      component.vetId = 1;
      component.reviewStats = {
        vetId: 1,
        averageRating: 4.5,
        totalReviews: 10,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: 'Excellent veterinarian!',
          createdAt: new Date()
        }
      };
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('.review-content')).toBeTruthy();
      expect(compiled.querySelector('.rating-display')).toBeTruthy();
      expect(compiled.querySelector('.view-reviews-link')).toBeTruthy();
    });

    it('should display average rating with one decimal place', () => {
      component.vetId = 1;
      component.reviewStats = {
        vetId: 1,
        averageRating: 4.567,
        totalReviews: 10,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: 'Great!',
          createdAt: new Date()
        }
      };
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const ratingValue = compiled.querySelector('.rating-value');
      expect(ratingValue.textContent).toBe('4.6');
    });

    it('should display correct number of reviews in count', () => {
      component.vetId = 1;
      component.reviewStats = {
        vetId: 1,
        averageRating: 4.5,
        totalReviews: 1,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: 'Great!',
          createdAt: new Date()
        }
      };
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const reviewCount = compiled.querySelector('.review-count');
      expect(reviewCount.textContent).toContain('1 review');
      expect(reviewCount.textContent).not.toContain('reviews');
    });

    it('should pluralize reviews when count is not 1', () => {
      component.vetId = 1;
      component.reviewStats = {
        vetId: 1,
        averageRating: 4.5,
        totalReviews: 5,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: 'Great!',
          createdAt: new Date()
        }
      };
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const reviewCount = compiled.querySelector('.review-count');
      expect(reviewCount.textContent).toContain('5 reviews');
    });

    it('should display View Reviews link with correct route', () => {
      component.vetId = 1;
      component.reviewStats = {
        vetId: 1,
        averageRating: 4.5,
        totalReviews: 5,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: 'Great!',
          createdAt: new Date()
        }
      };
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const link = compiled.querySelector('.view-reviews-link a');
      expect(link).toBeTruthy();
      expect(link.textContent).toContain('View Reviews');
    });

    it('should not display feedback section when feedback is empty', () => {
      component.vetId = 1;
      component.reviewStats = {
        vetId: 1,
        averageRating: 4.5,
        totalReviews: 5,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: '',
          createdAt: new Date()
        }
      };
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      expect(compiled.querySelector('.recent-review')).toBeFalsy();
    });

    it('should display truncated feedback when available', () => {
      component.vetId = 1;
      component.reviewStats = {
        vetId: 1,
        averageRating: 4.5,
        totalReviews: 5,
        mostRecentReview: {
          id: 1,
          vetId: 1,
          rating: 5,
          feedback: 'Excellent veterinarian with great care!',
          createdAt: new Date()
        }
      };
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const feedbackText = compiled.querySelector('.feedback-text');
      expect(feedbackText).toBeTruthy();
      expect(feedbackText.textContent).toBe('Excellent veterinarian with great care!');
    });
  });
});
