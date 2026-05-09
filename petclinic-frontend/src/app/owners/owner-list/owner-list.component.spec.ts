import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Subject, EMPTY } from 'rxjs';
import { delay } from 'rxjs/operators';

import { OwnerListComponent } from './owner-list.component';
import { OwnerService } from '../owner.service';
import { PageCacheService } from '../page-cache.service';
import { OwnerPage } from '../owner-page';
import { OwnerSummary } from '../owner-summary';

function makePage(page: number, size: number = 10, totalElements: number = 100): OwnerPage {
  const totalPages = Math.ceil(totalElements / size);
  const content: OwnerSummary[] = [];
  const start = page * size;
  const end = Math.min(start + size, totalElements);
  for (let i = start; i < end; i++) {
    content.push({
      id: i + 1,
      displayName: `Owner ${i + 1}`,
      address: `${i + 1} Main St`,
      city: 'City',
      telephone: '555000' + i,
      pets: []
    });
  }
  return { content, totalElements, totalPages, number: page, size };
}

describe('OwnerListComponent - State Transitions', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerServiceSpy: jasmine.SpyObj<OwnerService>;
  let pageCacheService: PageCacheService;

  beforeEach(() => {
    ownerServiceSpy = jasmine.createSpyObj('OwnerService', ['getOwnerPage', 'getOwners', 'getOwnerById', 'addOwner', 'updateOwner', 'deleteOwner']);
    ownerServiceSpy.getOwnerPage.and.returnValue(of(makePage(0)));

    TestBed.configureTestingModule({
      declarations: [OwnerListComponent],
      imports: [FormsModule, RouterTestingModule],
      providers: [
        { provide: OwnerService, useValue: ownerServiceSpy },
        PageCacheService
      ],
      schemas: [NO_ERRORS_SCHEMA]
    });

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    pageCacheService = fixture.debugElement.injector.get(PageCacheService);
  });

  describe('Sort state transitions', () => {
    it('should flip direction and reset page to 0 when clicking same sort column', fakeAsync(() => {
      fixture.detectChanges();
      tick(500); // wait for initial load

      // Initial state: sort = 'name,asc', page = 0
      expect(component.paginationState.sort).toBe('name,asc');
      expect(component.paginationState.page).toBe(0);

      // Navigate to page 2 first
      component.onPageChange(3); // 1-based from toolbar → 0-based internally = page 2
      tick(100);

      // Click same column (name) → should toggle to desc and reset page
      component.onSortChange('name');
      tick(100);

      expect(component.paginationState.sort).toBe('name,desc');
      expect(component.paginationState.page).toBe(0);
    }));

    it('should set new column ascending and reset page to 0 when clicking different column', fakeAsync(() => {
      fixture.detectChanges();
      tick(500);

      // Navigate to page 3
      component.onPageChange(4); // 1-based → page 3
      tick(100);

      // Click different column (city)
      component.onSortChange('city');
      tick(100);

      expect(component.paginationState.sort).toBe('city,asc');
      expect(component.paginationState.page).toBe(0);
    }));
  });

  describe('Page size change', () => {
    it('should reset page to 0 and invalidate cache when page size changes', fakeAsync(() => {
      fixture.detectChanges();
      tick(500);

      // Navigate to page 2
      component.onPageChange(3);
      tick(100);

      // Store something in cache to verify invalidation
      pageCacheService.storePage(0, 10, 'name,asc', '', makePage(0));

      // Change page size
      component.onPageSizeChange(25);
      tick(100);

      expect(component.paginationState.page).toBe(0);
      expect(component.paginationState.size).toBe(25);
      // Cache should be invalidated
      expect(pageCacheService.getPage(0, 10, 'name,asc', '')).toBeNull();
    }));
  });

  describe('Search input change', () => {
    it('should reset page to 0 and retain sort after debounced search', fakeAsync(() => {
      fixture.detectChanges();
      tick(500);

      // Change sort to city,desc first
      component.onSortChange('city');
      tick(100);

      // Navigate to page 2
      component.onPageChange(3);
      tick(100);

      // Type search
      component.onSearchInput('Franklin');
      tick(400); // debounce time

      expect(component.paginationState.page).toBe(0);
      expect(component.paginationState.q).toBe('Franklin');
      expect(component.paginationState.sort).toBe('city,asc'); // sort retained
    }));
  });

  describe('Page button click', () => {
    it('should update page number when page button is clicked', fakeAsync(() => {
      fixture.detectChanges();
      tick(500);

      // Click page 3 (1-based from toolbar)
      component.onPageChange(3);
      tick(100);

      expect(component.paginationState.page).toBe(2); // 0-based internally
    }));
  });

  describe('Loading indicator', () => {
    it('should show loading when page is not in cache', fakeAsync(() => {
      // Make the service return with a delay to simulate network
      const delayedPage$ = of(makePage(0)).pipe(delay(200)) as any;
      ownerServiceSpy.getOwnerPage.and.returnValue(delayedPage$);

      fixture.detectChanges();
      tick(0); // trigger initial load but don't wait for response

      expect(component.isLoading).toBe(true);

      tick(200); // wait for response
      expect(component.isLoading).toBe(false);

      flush();
    }));
  });

  describe('In-flight cancellation via switchMap', () => {
    it('should cancel previous request when rapid navigation occurs', fakeAsync(() => {
      let callCount = 0;
      const subjects: Subject<OwnerPage>[] = [];

      ownerServiceSpy.getOwnerPage.and.callFake(() => {
        const subject = new Subject<OwnerPage>();
        subjects.push(subject);
        callCount++;
        return subject.asObservable();
      });

      fixture.detectChanges();
      tick(0); // initial load triggers

      // Rapid navigation: page 1, then page 2, then page 3
      component.onPageChange(2); // page 1 (0-based)
      tick(0);
      component.onPageChange(3); // page 2 (0-based)
      tick(0);
      component.onPageChange(4); // page 3 (0-based)
      tick(0);

      // Only the last request should matter - resolve it
      const lastSubject = subjects[subjects.length - 1];
      lastSubject.next(makePage(3));
      lastSubject.complete();
      tick(0);

      // Component should show page 3 data
      expect(component.paginationState.page).toBe(3);
      // Previous in-flight requests should have been cancelled (switchMap behavior)
      // The component should not process stale responses
      expect(component.currentPage?.number).toBe(3);

      flush();
    }));
  });
});
