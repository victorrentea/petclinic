import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { VetReviewDetailsComponent } from './vet-review-details.component';
import { ReviewService } from '../review.service';
import { VetService } from '../vet.service';
import { Review } from '../review.model';
import { Vet } from '../vet';

describe('VetReviewDetailsComponent', () => {
  let component: VetReviewDetailsComponent;
  let fixture: ComponentFixture<VetReviewDetailsComponent>;
  let mockReviewService: jasmine.SpyObj<ReviewService>;
  let mockVetService: jasmine.SpyObj<VetService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;
  let mockDomSanitizer: jasmine.SpyObj<DomSanitizer>;

  const mockVet: Vet = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    specialties: [{ id: 1, name: 'Surgery' }]
  };

  const mockReviews: Review[] = [
    {
      id: 1,
      vetId: 1,
      rating: 5,
      feedback: 'Excellent care!',
      createdAt: new Date('2024-01-15T10:30:00')
    },
    {
      id: 2,
      vetId: 1,
      rating: 4,
      feedback: 'Very professional.',
      createdAt: new Date('2024-01-10T14:20:00')
    }
  ];

  beforeEach(async () => {
    mockReviewService = jasmine.createSpyObj('ReviewService', ['getReviewsByVetId']);
    mockVetService = jasmine.createSpyObj('VetService', ['getVetById']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockDomSanitizer = jasmine.createSpyObj('DomSanitizer', ['sanitize']);
    mockActivatedRoute = {
      params: of({ id: '1' })
    };

    await TestBed.configureTestingModule({
      declarations: [VetReviewDetailsComponent],
      providers: [
        { provide: ReviewService, useValue: mockReviewService },
        { provide: VetService, useValue: mockVetService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: DomSanitizer, useValue: mockDomSanitizer }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VetReviewDetailsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load reviews on init', () => {
    mockVetService.getVetById.and.returnValue(of(mockVet));
    mockReviewService.getReviewsByVetId.and.returnValue(of(mockReviews));

    fixture.detectChanges();

    expect(component.vetId).toBe(1);
    expect(mockReviewService.getReviewsByVetId).toHaveBeenCalledWith(1);
    expect(component.reviews.length).toBe(2);
    expect(component.isLoading).toBe(false);
  });

  it('should sort reviews by date in reverse chronological order', () => {
    const unsortedReviews: Review[] = [
      {
        id: 1,
        vetId: 1,
        rating: 5,
        feedback: 'Old review',
        createdAt: new Date('2024-01-01T10:00:00')
      },
      {
        id: 2,
        vetId: 1,
        rating: 4,
        feedback: 'New review',
        createdAt: new Date('2024-01-15T10:00:00')
      }
    ];

    const sorted = component.sortReviewsByDate([...unsortedReviews]);

    expect(sorted[0].id).toBe(2); // Most recent first
    expect(sorted[1].id).toBe(1);
  });

  it('should render stars correctly', () => {
    const stars5 = component.renderStars(5);
    expect(stars5.length).toBe(5);
    expect(stars5.filter(s => s === '★').length).toBe(5);

    const stars3 = component.renderStars(3);
    expect(stars3.length).toBe(5);
    expect(stars3.filter(s => s === '★').length).toBe(3);
    expect(stars3.filter(s => s === '☆').length).toBe(2);
  });

  it('should sanitize feedback text', () => {
    const feedback = 'Great service!';
    const sanitized = component.sanitizeFeedback(feedback);
    expect(sanitized).toBe(feedback);
  });

  it('should return empty string for null feedback', () => {
    const sanitized = component.sanitizeFeedback('');
    expect(sanitized).toBe('');
  });

  it('should format date correctly', () => {
    const date = new Date('2024-01-15T10:30:00');
    const formatted = component.formatDate(date);
    expect(formatted).toContain('2024');
    expect(formatted).toContain('January');
  });

  it('should navigate back to vets list', () => {
    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/vets']);
  });

  it('should handle empty reviews list', () => {
    mockVetService.getVetById.and.returnValue(of(mockVet));
    mockReviewService.getReviewsByVetId.and.returnValue(of([]));

    fixture.detectChanges();

    expect(component.hasReviews).toBe(false);
    expect(component.reviews.length).toBe(0);
  });

  it('should handle error loading reviews', () => {
    mockVetService.getVetById.and.returnValue(of(mockVet));
    mockReviewService.getReviewsByVetId.and.returnValue(
      throwError(() => new Error('Network error'))
    );

    fixture.detectChanges();

    expect(component.errorMessage).toBeTruthy();
    expect(component.isLoading).toBe(false);
  });

  it('should display vet name correctly', () => {
    component.vet = mockVet;
    expect(component.vetName).toBe('John Doe');
  });

  it('should display default name when vet is null', () => {
    component.vet = null;
    expect(component.vetName).toBe('Veterinarian');
  });

  it('should handle invalid vet ID', () => {
    mockActivatedRoute.params = of({ id: null });
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Invalid veterinarian ID');
    expect(component.isLoading).toBe(false);
  });
});
