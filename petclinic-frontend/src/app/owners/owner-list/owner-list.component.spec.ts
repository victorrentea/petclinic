import { CommonModule } from '@angular/common';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';

import { OwnerService } from '../owner.service';
import { Owner, OwnerPage } from '../owner';
import { OwnerListComponent } from './owner-list.component';

describe('OwnerListComponent', () => {
  const CURRENT_PAGE = 2;
  const PAGE_SIZE = 20;
  const TOTAL_PAGES = 5;
  const TOTAL_ELEMENTS = 42;

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: jasmine.SpyObj<OwnerService>;
  let router: Router;
  let activatedRoute: ActivatedRoute;
  let queryParams: BehaviorSubject<Params>;

  const expectedOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };

  const expectedPage: OwnerPage = {
    content: [expectedOwner],
    totalElements: TOTAL_ELEMENTS,
    totalPages: TOTAL_PAGES,
    number: CURRENT_PAGE,
    size: PAGE_SIZE
  };

  beforeEach(async () => {
    queryParams = new BehaviorSubject<Params>({});
    ownerService = jasmine.createSpyObj<OwnerService>('OwnerService', ['searchOwners']);
    ownerService.searchOwners.and.returnValue(of(expectedPage));

    await TestBed.configureTestingModule({
      declarations: [OwnerListComponent],
      imports: [CommonModule, FormsModule, RouterTestingModule.withRoutes([])],
      providers: [
        { provide: OwnerService, useValue: ownerService },
        { provide: ActivatedRoute, useValue: { queryParams } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    activatedRoute = TestBed.inject(ActivatedRoute);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('reads initial query params and loads matching owner page', () => {
    queryParams.next({ query: 'foo', page: '2', size: '20', sort: 'city,desc' });

    fixture.detectChanges();

    expect(ownerService.searchOwners).toHaveBeenCalledWith('foo', 2, 20, 'city,desc');
  });

  it('navigates to the selected page while keeping other query params', () => {
    queryParams.next({ query: 'foo', page: '2', size: '20', sort: 'city,desc' });

    fixture.detectChanges();
    fixture.detectChanges();

    const pageFourButton = fixture.debugElement
      .queryAll(By.css('.pagination button'))
      .find((button) => button.nativeElement.textContent.trim() === '4');

    expect(pageFourButton).toBeTruthy();

    pageFourButton!.nativeElement.click();

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: activatedRoute,
      queryParams: { query: 'foo', page: 3, size: 20, sort: 'city,desc' },
      queryParamsHandling: 'merge'
    });
  });

  it('resets the page to the first page when the page size changes', () => {
    queryParams.next({ query: 'foo', page: '2', size: '20', sort: 'city,desc' });

    fixture.detectChanges();

    component.size = 10;
    component.onSizeChange();

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: activatedRoute,
      queryParams: { query: 'foo', page: 0, size: 10, sort: 'city,desc' },
      queryParamsHandling: 'merge'
    });
  });

  it('renders a compact pager toolbar with page size and page buttons on the same line', () => {
    queryParams.next({ query: 'foo', page: '1', size: '20', sort: 'city,desc' });

    fixture.detectChanges();
    fixture.detectChanges();

    const toolbar = fixture.debugElement.query(By.css('.owners-table-toolbar'));
    const pageSizeGroup = fixture.debugElement.query(By.css('.owners-page-size'));
    const pageSizeSelect = fixture.debugElement.query(By.css('.owners-page-size-select'));
    const pagination = fixture.debugElement.query(By.css('.owners-pagination'));

    expect(toolbar).toBeTruthy();
    expect(pageSizeGroup).toBeTruthy();
    expect(pageSizeSelect).toBeTruthy();
    expect(pagination).toBeTruthy();
    expect(toolbar.nativeElement.contains(pageSizeGroup.nativeElement)).toBeTrue();
    expect(toolbar.nativeElement.contains(pagination.nativeElement)).toBeTrue();
  });

  it('toggles the name sort direction and resets the page', () => {
    queryParams.next({ query: 'foo', page: '2', size: '20', sort: 'name,asc' });

    fixture.detectChanges();
    fixture.detectChanges();

    const nameSortButton = fixture.debugElement
      .queryAll(By.css('th button'))
      .find((button) => button.nativeElement.textContent.trim().startsWith('Name'));

    expect(nameSortButton).toBeTruthy();

    nameSortButton!.nativeElement.click();

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: activatedRoute,
      queryParams: { query: 'foo', page: 0, size: 20, sort: 'name,desc' },
      queryParamsHandling: 'merge'
    });
  });

  it('resets the page to the first page when the query changes (debounced)', fakeAsync(() => {
    queryParams.next({ query: 'foo', page: '2', size: '20', sort: 'city,desc' });

    fixture.detectChanges();
    (router.navigate as jasmine.Spy).calls.reset();

    component.query = 'bar';
    component.onQueryChange();

    expect(router.navigate).not.toHaveBeenCalled();

    tick(300);

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: activatedRoute,
      queryParams: { query: 'bar', page: 0, size: 20, sort: 'city,desc' },
      queryParamsHandling: 'merge'
    });
  }));

  describe('pageNumbers', () => {
    it('returns empty array when no page is loaded', () => {
      expect(component.pageNumbers).toEqual([]);
    });

    it('returns [0] for a single page', () => {
      component.ownerPage = { content: [], totalElements: 1, totalPages: 1, number: 0, size: 10 };
      component.page = 0;
      expect(component.pageNumbers).toEqual([0]);
    });

    it('returns first, next, midpoint, and last on page 0 of 10', () => {
      component.ownerPage = { content: [], totalElements: 100, totalPages: 10, number: 0, size: 10 };
      component.page = 0;
      // first=0, last=9, current=0, prev=−1(filtered), next=1, mid-begin=0, mid-end=4
      expect(component.pageNumbers).toEqual([0, 1, 4, 9]);
    });

    it('returns all pages when in the middle of a small range (page 2 of 5)', () => {
      component.ownerPage = { content: [], totalElements: 42, totalPages: 5, number: 2, size: 10 };
      component.page = 2;
      // first=0, last=4, current=2, prev=1, next=3, mid-begin=1, mid-end=3 → deduped [0,1,2,3,4]
      expect(component.pageNumbers).toEqual([0, 1, 2, 3, 4]);
    });

    it('returns first, midpoint, prev, and last on the final page of 10', () => {
      component.ownerPage = { content: [], totalElements: 100, totalPages: 10, number: 9, size: 10 };
      component.page = 9;
      // first=0, last=9, current=9, prev=8, next=10(filtered), mid-begin=4, mid-end=9
      expect(component.pageNumbers).toEqual([0, 4, 8, 9]);
    });
  });
});
