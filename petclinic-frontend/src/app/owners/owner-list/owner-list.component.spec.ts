import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { EMPTY_OWNER_PAGE, OwnerPage, OwnerQuery } from '../owner-page';
import { Observable, of, Subject, throwError } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { PartsModule } from '../../parts/parts.module';
import { ActivatedRouteStub } from '../../testing/router-stubs';
import { OwnerDetailComponent } from '../owner-detail/owner-detail.component';
import { OwnersModule } from '../owners.module';
import { DummyComponent } from '../../testing/dummy.component';
import { OwnerAddComponent } from '../owner-add/owner-add.component';
import { OwnerEditComponent } from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  getOwners(query: OwnerQuery): Observable<OwnerPage> {
    return of(EMPTY_OWNER_PAGE);
  }
}

const harry: Owner = {
  id: 1,
  firstName: 'Harry',
  lastName: 'Potter',
  address: '4 Privet Drive',
  city: 'Little Whinging',
  telephone: '6085551023',
  pets: []
};

function pageOf(content: Owner[], overrides: Partial<OwnerPage> = {}): OwnerPage {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length === 0 ? 0 : 1,
    number: 0,
    size: 10,
    ...overrides
  };
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: OwnerServiceStub = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let navigateSpy: Spy;
  let route: ActivatedRouteStub;

  /** the queryParams the component navigated with on its most recent interaction */
  function navigatedQueryParams(): any {
    return navigateSpy.calls.mostRecent().args[1].queryParams;
  }

  function renderWith(queryParams: any, page: OwnerPage) {
    route.testQueryParams = queryParams;
    getOwnersSpy.and.returnValue(of(page));
    fixture.detectChanges();
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes(
          [{path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [
        {provide: OwnerService, useValue: ownerService},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    route = TestBed.inject(ActivatedRoute) as unknown as ActivatedRouteStub;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners').and.returnValue(of(pageOf([harry])));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate');
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------- 7.1 / 7.4 / 7.5

  it('requests the server defaults - page 0, size 10, Name ascending - for a bare URL', () => {
    renderWith({}, pageOf([harry]));

    expect(getOwnersSpy).toHaveBeenCalledWith(
      {page: 0, size: 10, sort: 'lastName', direction: 'asc', lastName: ''});
  });

  it('reads its initial state from the query params (deep link)', () => {
    renderWith({page: '2', size: '20', sort: 'city', direction: 'desc', lastName: 'Po'},
      pageOf([harry], {number: 2, size: 20, totalElements: 45, totalPages: 3}));

    expect(getOwnersSpy).toHaveBeenCalledWith(
      {page: 2, size: 20, sort: 'city', direction: 'desc', lastName: 'Po'});
  });

  it('re-requests from the server when the query params change (no client-side sorting)', () => {
    renderWith({}, pageOf([harry]));
    getOwnersSpy.calls.reset();

    route.testQueryParams = {sort: 'city', direction: 'asc'};

    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({sort: 'city', direction: 'asc'}));
  });

  it('navigates with merged query params rather than mutating state', () => {
    renderWith({}, pageOf([harry]));

    component.sortBy('city');

    const [commands, extras] = navigateSpy.calls.mostRecent().args;
    expect(commands).toEqual([]);
    expect(extras.queryParamsHandling).toBe('merge');
    expect(extras.relativeTo).toBe(route as any);
  });

  // ---------------------------------------------------------------- 7.6 / 7.7 (D16)

  describe('every change except the pager resets page to 0', () => {
    beforeEach(() => {
      renderWith({page: '4', size: '10', sort: 'lastName', direction: 'asc', lastName: 'Po'},
        pageOf([harry], {number: 4, totalElements: 45, totalPages: 5}));
    });

    it('resets page when the lastName filter changes, preserving the rest', () => {
      component.searchByLastName('Wea');

      expect(navigatedQueryParams()).toEqual({lastName: 'Wea', page: 0});
    });

    it('clears the lastName param when the search box is emptied', () => {
      component.searchByLastName('');

      expect(navigatedQueryParams()).toEqual({lastName: null, page: 0});
    });

    it('resets page when the sort column changes, preserving the rest', () => {
      component.sortBy('city');

      expect(navigatedQueryParams()).toEqual({sort: 'city', direction: 'asc', page: 0});
    });

    it('resets page when the sort direction is reversed on the same column', () => {
      component.sortBy('lastName');

      expect(navigatedQueryParams()).toEqual({sort: 'lastName', direction: 'desc', page: 0});
    });

    it('resets page when the page size changes, preserving the rest', () => {
      component.changePageSize('20');

      expect(navigatedQueryParams()).toEqual({size: 20, page: 0});
    });

    it('the pager itself resets nothing - it only moves page', () => {
      component.goToPage(5);

      expect(navigatedQueryParams()).toEqual({page: 5});
    });
  });

  it('searches when the Find Owner button is pressed', () => {
    renderWith({}, pageOf([harry]));
    component.lastName = 'Wea';
    fixture.detectChanges();

    fixture.debugElement.query(By.css('#search-owner-form button[type="submit"]'))
      .nativeElement.click();

    expect(navigatedQueryParams()).toEqual({lastName: 'Wea', page: 0});
  });

  // ---------------------------------------------------------------- 8.1 (D5)

  it('renders the Name cell as "lastName, firstName"', () => {
    renderWith({}, pageOf([harry]));

    const nameCell = fixture.debugElement.query(By.css('.ownerFullName')).nativeElement;
    expect(nameCell.textContent.trim()).toBe('Potter, Harry');
  });

  // ---------------------------------------------------------------- 8.2 (D17)

  it('renders the no-owners message for an empty result (an empty array is truthy)', () => {
    renderWith({lastName: 'Zzz'}, pageOf([]));

    expect(fixture.debugElement.query(By.css('#noOwners'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('#ownersTable tbody tr')).length).toBe(0);
  });

  it('does not render the no-owners message when the page has owners', () => {
    renderWith({}, pageOf([harry]));

    expect(fixture.debugElement.query(By.css('#noOwners'))).toBeNull();
  });

  // review feedback: the control bar moved below the table, and Add Owner joined it

  it('places the page-size selector and pager below the table, with Add Owner', () => {
    renderWith({}, pageOf([harry]));

    const controls = fixture.debugElement.query(By.css('.owners-controls')).nativeElement;
    const table = fixture.debugElement.query(By.css('.owners-table')).nativeElement;
    // DOCUMENT_POSITION_FOLLOWING === the control bar comes after the table in document order
    expect(table.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(controls.querySelector('#addOwner')).toBeTruthy();
    expect(controls.querySelector('#pageSize')).toBeTruthy();
    expect(controls.querySelector('#nextPage')).toBeTruthy();
  });

  it('keeps Add Owner available when the search matched nothing', () => {
    renderWith({lastName: 'Zzz'}, pageOf([]));

    expect(fixture.debugElement.query(By.css('#addOwner'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#pageSize'))).toBeNull();
    expect(fixture.debugElement.query(By.css('#nextPage'))).toBeNull();
  });

  // ---------------------------------------------------------------- 8.3 / 8.4

  it('makes exactly the Name and City headers sortable', () => {
    renderWith({}, pageOf([harry]));

    const sortable = fixture.debugElement.queryAll(By.css('th.sortable'))
      .map((th) => th.nativeElement.textContent.replace(/[▲▼]/g, '').trim());
    expect(sortable).toEqual(['Name', 'City']);
  });

  it('leaves Address, Telephone and Pets headers inert', () => {
    renderWith({}, pageOf([harry]));

    const inert = fixture.debugElement.queryAll(By.css('thead th:not(.sortable)'))
      .map((th) => th.nativeElement.textContent.trim());
    expect(inert).toEqual(['Address', 'Telephone', 'Pets']);
  });

  it('shows an ascending indicator on the active sort column only', () => {
    renderWith({sort: 'city', direction: 'asc'}, pageOf([harry]));

    const indicators = fixture.debugElement.queryAll(By.css('th .sort-indicator'));
    expect(indicators.length).toBe(1);
    expect(indicators[0].nativeElement.textContent.trim()).toBe('▲');
    expect(indicators[0].parent.nativeElement.textContent).toContain('City');
  });

  it('shows a descending indicator when sorted descending', () => {
    renderWith({sort: 'lastName', direction: 'desc'}, pageOf([harry]));

    const indicator = fixture.debugElement.query(By.css('th .sort-indicator')).nativeElement;
    expect(indicator.textContent.trim()).toBe('▼');
  });

  // review feedback: a sortable column must advertise itself even when it is not the active sort,
  // otherwise it is indistinguishable from plain text and nobody discovers it sorts

  it('shows a greyed ascending hint on the idle sortable column', () => {
    renderWith({sort: 'city', direction: 'asc'}, pageOf([harry]));

    const hints = fixture.debugElement.queryAll(By.css('th .sort-hint'));
    expect(hints.length).toBe(1);
    expect(hints[0].nativeElement.textContent.trim()).toBe('▲');
    expect(hints[0].parent!.nativeElement.textContent).toContain('Name');
  });

  it('never shows a hint and an indicator on the same header', () => {
    renderWith({sort: 'lastName', direction: 'desc'}, pageOf([harry]));

    const activeHeader = fixture.debugElement.query(By.css('#sortByName'));
    expect(activeHeader.query(By.css('.sort-indicator'))).toBeTruthy();
    expect(activeHeader.query(By.css('.sort-hint'))).toBeNull();
  });

  it('gives no sort affordance to the inert headers', () => {
    renderWith({}, pageOf([harry]));

    const inertAffordances = fixture.debugElement
      .queryAll(By.css('thead th:not(.sortable) .sort-hint, thead th:not(.sortable) .sort-indicator'));
    expect(inertAffordances.length).toBe(0);
  });

  it('toggles the sort when the Name header is clicked', () => {
    renderWith({}, pageOf([harry]));

    fixture.debugElement.query(By.css('#sortByName')).nativeElement.click();

    expect(navigatedQueryParams()).toEqual({sort: 'lastName', direction: 'desc', page: 0});
  });

  it('switches the sort column when the City header is clicked', () => {
    renderWith({}, pageOf([harry]));

    fixture.debugElement.query(By.css('#sortByCity')).nativeElement.click();

    expect(navigatedQueryParams()).toEqual({sort: 'city', direction: 'asc', page: 0});
  });

  // ---------------------------------------------------------------- 8.5

  it('disables the previous control on the first page', () => {
    renderWith({}, pageOf([harry], {number: 0, totalElements: 25, totalPages: 3}));

    expect(fixture.debugElement.query(By.css('#previousPage')).nativeElement.disabled).toBe(true);
    expect(fixture.debugElement.query(By.css('#nextPage')).nativeElement.disabled).toBe(false);
  });

  it('disables the next control on the last page', () => {
    renderWith({page: '2'}, pageOf([harry], {number: 2, totalElements: 25, totalPages: 3}));

    expect(fixture.debugElement.query(By.css('#previousPage')).nativeElement.disabled).toBe(false);
    expect(fixture.debugElement.query(By.css('#nextPage')).nativeElement.disabled).toBe(true);
  });

  it('shows the current position and the total number of pages', () => {
    renderWith({page: '1'}, pageOf([harry], {number: 1, totalElements: 25, totalPages: 3}));

    const position = fixture.debugElement.query(By.css('#pagePosition')).nativeElement;
    expect(position.textContent).toContain('2');
    expect(position.textContent).toContain('3');
  });

  it('advances one page when the next control is clicked', () => {
    renderWith({page: '1'}, pageOf([harry], {number: 1, totalElements: 25, totalPages: 3}));

    fixture.debugElement.query(By.css('#nextPage')).nativeElement.click();

    expect(navigatedQueryParams()).toEqual({page: 2});
  });

  // ---------------------------------------------------------------- 8.6

  it('offers exactly the page sizes 5, 10 and 20', () => {
    renderWith({}, pageOf([harry]));

    const sizes = fixture.debugElement.queryAll(By.css('#pageSize option'))
      .map((option) => option.nativeElement.textContent.trim());
    expect(sizes).toEqual(['5', '10', '20']);
  });

  // ---------------------------------------------------------------- D11 / 8.3

  it('renders a plain Bootstrap table, never a mat-table', () => {
    renderWith({}, pageOf([harry]));

    expect(fixture.debugElement.query(By.css('table.table.table-striped'))).toBeTruthy();
    expect(fixture.nativeElement.querySelector('mat-table, table[mat-table]')).toBeNull();
  });

  // -------------------------------------------------- review-round correctness fixes

  // finding 1: a page past the end has no rows but still has a result set — the pager (and its
  // Previous) must stay reachable, or a deep-linked ?page=99 strands the user
  it('keeps the pager reachable on a page past the end instead of stranding the user', () => {
    renderWith({page: '9'}, pageOf([], {number: 9, totalElements: 28, totalPages: 3}));

    expect(fixture.debugElement.query(By.css('#noOwners'))).toBeNull();
    expect(fixture.debugElement.query(By.css('#previousPage'))).toBeTruthy();
  });

  // finding 3: a load failure must read as a failure, not as an empty result
  it('surfaces a load error instead of the empty-owners message', () => {
    route.testQueryParams = {};
    getOwnersSpy.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#ownersError'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#noOwners'))).toBeNull();
  });

  // findings 2 + 3: catching inside switchMap must keep the queryParams stream alive, so the next
  // navigation after a failure still reloads
  it('recovers on the next navigation after a failed load', () => {
    route.testQueryParams = {};
    getOwnersSpy.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    getOwnersSpy.and.returnValue(of(pageOf([harry])));
    route.testQueryParams = {lastName: 'Po'};
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#ownersError'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.ownerFullName'))).toBeTruthy();
  });

  // finding 2: a stale response that lands after a newer navigation must be discarded. With a plain
  // nested subscribe the first request is never cancelled, so its late response clobbers the newer
  // page; switchMap cancels it. Driving the two responses out of order proves the cancellation.
  it('discards a stale response that arrives after a newer navigation', () => {
    const betty: Owner = {...harry, id: 2, firstName: 'Betty', lastName: 'Davis'};
    const firstResponse = new Subject<OwnerPage>();
    const secondResponse = new Subject<OwnerPage>();
    getOwnersSpy.and.returnValues(firstResponse.asObservable(), secondResponse.asObservable());

    route.testQueryParams = {page: '0'};
    fixture.detectChanges();               // subscribes to firstResponse
    route.testQueryParams = {page: '1'};
    fixture.detectChanges();               // switchMap cancels firstResponse, subscribes to second

    secondResponse.next(pageOf([harry], {number: 1}));  // newer request resolves first
    firstResponse.next(pageOf([betty], {number: 0}));   // stale request resolves late — ignored
    fixture.detectChanges();

    expect(component.owners.map((o) => o.firstName)).toEqual(['Harry']);
  });

  // finding 8: an out-of-range size/page must not desync the page-size select from the rows shown
  it('falls back to the default size when the URL size is not an offered option', () => {
    renderWith({size: '0'}, pageOf([harry]));

    expect(getOwnersSpy).toHaveBeenCalledWith(jasmine.objectContaining({size: 10}));
  });

  it('falls back to page 0 for a non-integer page index', () => {
    renderWith({page: '1.5'}, pageOf([harry]));

    expect(getOwnersSpy).toHaveBeenCalledWith(jasmine.objectContaining({page: 0}));
  });
});
