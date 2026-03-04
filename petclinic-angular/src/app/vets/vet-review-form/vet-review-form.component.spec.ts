import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { VetReviewFormComponent } from './vet-review-form.component';
import { ReviewService } from '../review.service';
import { SanitizationService } from '../sanitization.service';
import { Review } from '../review.model';

describe('VetReviewFormComponent', () => {
  let component: VetReviewFormComponent;
  let fixture: ComponentFixture<VetReviewFormComponent>;
  let mockReviewService: jasmine.SpyObj<ReviewService>;
  let mockSanitizationService: jasmine.SpyObj<SanitizationService>;

  beforeEach(async () => {
    mockReviewService = jasmine.createSpyObj('ReviewService', ['submitReview']);
    mockSanitizationService = jasmine.createSpyObj('SanitizationService', ['sanitizeFeedback']);

    await TestBed.configureTestingModule({
      declarations: [VetReviewFormComponent],
      imports: [FormsModule],
      providers: [
        { provide: ReviewService, useValue: mockReviewService },
        { provide: SanitizationService, useValue: mockSanitizationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VetReviewFormComponent);
    component = fixture.componentInstance;
    component.vetId = 1;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Rating Validation', () => {
    it('should accept valid ratings 1-5', () => {
      expect(component.validateRating(1)).toBe(true);
      expect(component.validateRating(2)).toBe(true);
      expect(component.validateRating(3)).toBe(true);
      expect(component.validateRating(4)).toBe(true);
      expect(component.validateRating(5)).toBe(true);
    });

    it('should reject ratings outside 1-5 range', () => {
      expect(component.validateRating(0)).toBe(false);
      expect(component.validateRating(6)).toBe(false);
      expect(component.validateRating(-1)).toBe(false);
      expect(component.validateRating(10)).toBe(false);
    });

    it('should reject non-integer ratings', () => {
      expect(component.validateRating(3.5)).toBe(false);
      expect(component.validateRating(2.1)).toBe(false);
    });
  });

  describe('Feedback Validation', () => {
    it('should accept feedback with 500 or fewer characters', () => {
      expect(component.validateFeedback('')).toBe(true);
      expect(component.validateFeedback('Short feedback')).toBe(true);
      expect(component.validateFeedback('a'.repeat(500))).toBe(true);
    });

    it('should reject feedback exceeding 500 characters', () => {
      expect(component.validateFeedback('a'.repeat(501))).toBe(false);
      expect(component.validateFeedback('a'.repeat(1000))).toBe(false);
    });
  });

  describe('Star Rating Selector', () => {
    it('should set rating when star is clicked', () => {
      component.setRating(4);
      expect(component.rating).toBe(4);
    });

    it('should clear error message when rating is set', () => {
      component.errorMessage = 'Some error';
      component.setRating(3);
      expect(component.errorMessage).toBe('');
    });
  });

  describe('Character Counter', () => {
    it('should return correct character count', () => {
      component.feedback = 'Test feedback';
      expect(component.characterCount).toBe(13);
    });

    it('should return 0 for empty feedback', () => {
      component.feedback = '';
      expect(component.characterCount).toBe(0);
    });

    it('should indicate when over limit', () => {
      component.feedback = 'a'.repeat(501);
      expect(component.isOverLimit).toBe(true);
    });

    it('should not indicate over limit when at or below limit', () => {
      component.feedback = 'a'.repeat(500);
      expect(component.isOverLimit).toBe(false);
    });
  });

  describe('Submit Review', () => {
    beforeEach(() => {
      mockSanitizationService.sanitizeFeedback.and.returnValue('sanitized feedback');
    });

    it('should display error if rating is not set', () => {
      component.rating = 0;
      component.feedback = 'Good vet';
      component.submitReview();

      expect(component.errorMessage).toBe('Rating must be between 1 and 5 stars');
      expect(mockReviewService.submitReview).not.toHaveBeenCalled();
    });

    it('should display error if feedback exceeds 500 characters', () => {
      component.rating = 5;
      component.feedback = 'a'.repeat(501);
      component.submitReview();

      expect(component.errorMessage).toContain('Feedback must be 500 characters or less');
      expect(mockReviewService.submitReview).not.toHaveBeenCalled();
    });

    it('should display error if vetId is not provided', () => {
      component.vetId = null as any;
      component.rating = 5;
      component.feedback = 'Good vet';
      component.submitReview();

      expect(component.errorMessage).toBe('Unable to submit review: veterinarian not specified');
      expect(mockReviewService.submitReview).not.toHaveBeenCalled();
    });

    it('should sanitize feedback before submission', () => {
      component.rating = 5;
      component.feedback = 'Great <b>vet</b>!';
      
      const mockReview: Review = {
        id: 1,
        vetId: 1,
        rating: 5,
        feedback: 'sanitized feedback',
        createdAt: new Date()
      };
      mockReviewService.submitReview.and.returnValue(of(mockReview));

      component.submitReview();

      expect(mockSanitizationService.sanitizeFeedback).toHaveBeenCalledWith('Great <b>vet</b>!');
    });

    it('should display error if sanitization fails', () => {
      component.rating = 5;
      component.feedback = '<script>alert("xss")</script>';
      mockSanitizationService.sanitizeFeedback.and.throwError('Invalid content');

      component.submitReview();

      expect(component.errorMessage).toContain('Invalid');
      expect(mockReviewService.submitReview).not.toHaveBeenCalled();
    });

    it('should submit valid review and display success message', () => {
      component.rating = 5;
      component.feedback = 'Excellent care!';
      
      const mockReview: Review = {
        id: 1,
        vetId: 1,
        rating: 5,
        feedback: 'sanitized feedback',
        createdAt: new Date()
      };
      mockReviewService.submitReview.and.returnValue(of(mockReview));

      component.submitReview();

      expect(mockReviewService.submitReview).toHaveBeenCalledWith({
        vetId: 1,
        rating: 5,
        feedback: 'sanitized feedback'
      });
      expect(component.successMessage).toBe('Review submitted successfully!');
      expect(component.errorMessage).toBe('');
    });

    it('should emit reviewSubmitted event on success', (done) => {
      component.rating = 5;
      component.feedback = 'Great vet!';
      
      const mockReview: Review = {
        id: 1,
        vetId: 1,
        rating: 5,
        feedback: 'sanitized feedback',
        createdAt: new Date()
      };
      mockReviewService.submitReview.and.returnValue(of(mockReview));

      component.reviewSubmitted.subscribe((review: Review) => {
        expect(review).toEqual(mockReview);
        done();
      });

      component.submitReview();
    });

    it('should reset form after successful submission', () => {
      component.rating = 5;
      component.feedback = 'Great vet!';
      
      const mockReview: Review = {
        id: 1,
        vetId: 1,
        rating: 5,
        feedback: 'sanitized feedback',
        createdAt: new Date()
      };
      mockReviewService.submitReview.and.returnValue(of(mockReview));

      component.submitReview();

      expect(component.rating).toBe(0);
      expect(component.feedback).toBe('');
    });

    it('should display error message on submission failure', (done) => {
      component.rating = 5;
      component.feedback = 'Great vet!';
      
      // The ReviewService catches errors and returns empty object
      // So we need to test the actual error path in the component
      mockReviewService.submitReview.and.returnValue(
        throwError(() => new Error('Server error'))
      );

      component.submitReview();

      // Wait for async operation to complete
      setTimeout(() => {
        expect(component.errorMessage).toContain('error');
        expect(component.successMessage).toBe('');
        expect(component.isSubmitting).toBe(false);
        done();
      }, 100);
    });

    it('should handle empty feedback', () => {
      component.rating = 4;
      component.feedback = '';
      
      const mockReview: Review = {
        id: 1,
        vetId: 1,
        rating: 4,
        feedback: '',
        createdAt: new Date()
      };
      mockReviewService.submitReview.and.returnValue(of(mockReview));

      component.submitReview();

      expect(mockReviewService.submitReview).toHaveBeenCalledWith({
        vetId: 1,
        rating: 4,
        feedback: ''
      });
    });
  });

  describe('Cancel', () => {
    it('should reset form when cancel is clicked', () => {
      component.rating = 5;
      component.feedback = 'Some feedback';
      component.errorMessage = 'Some error';
      component.successMessage = 'Success';

      component.cancel();

      expect(component.rating).toBe(0);
      expect(component.feedback).toBe('');
      expect(component.errorMessage).toBe('');
      expect(component.successMessage).toBe('');
    });
  });
});
