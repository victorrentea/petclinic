import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, convertToParamMap, Params, Router} from '@angular/router';
import {OwnerPage, OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {BehaviorSubject, of, Subject, throwError} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {PartsModule} from '../../parts/parts.module';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {HttpErrorHandler} from '../../error.service';
import Spy = jasmine.Spy;

/** ActivatedRoute driven by the test: the component's only source of view state. */
class ActivatedRouteQueryStub {
  private subject = new BehaviorSubject(convertToParamMap({}));
  queryParamMap = this.subject.asObservable();

  setQueryParams(params: Params) {
    this.subject.next(convertToParamMap(params));
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: OwnerService;
  let route: ActivatedRouteQueryStub;
  let router: Router;
  let getOwnersSpy: Spy;
  let navigateSpy: Spy;

  const franklin: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    petCount: 1,
    pets: [{name: 'Leo'} as any]
  };
  const potter: Owner = {
    id: 2,
    firstName: 'Beatrix',
    lastName: 'Potter',
    address: '638 Cardinal Ave.',
    city: 'Sun Prairie',
    telephone: '6085551749',
    petCount: 0,
    pets: []
  };

  function pageOf(content: Owner[], totalElements = content.length, number = 0, size = 10): OwnerPage {
    return {content, totalElements, number, size};
  }

  function lastNavigatedQueryParams(): Params {
    return navigateSpy.calls.mostRecent().args[1].queryParams;
  }

  function lastNavigateExtras(): any {
    return navigateSpy.calls.mostRecent().args[1];
  }

  beforeEach(waitForAsync(() => {
    route = new ActivatedRouteQueryStub();
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule, NoopAnimationsModule,
        HttpClientTestingModule, RouterTestingModule],
      providers: [
        HttpErrorHandler,
        {provide: ActivatedRoute, useValue: route}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    router = TestBed.inject(Router);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(pageOf([franklin])));
    navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('requests the default view when no query parameters are present', () => {
    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('shows the full name of a returned owner', () => {
    fixture.detectChanges();

    const cell = fixture.debugElement.query(By.css('.ownerFullName')).nativeElement;
    expect(cell.innerText.trim()).toBe('George Franklin');
  });

  describe('changing sort, page size or search returns to the first page', () => {

    beforeEach(() => {
      route.setQueryParams({lastName: '', page: '3', size: '10', sort: 'name,asc'});
      fixture.detectChanges();
      navigateSpy.calls.reset();
    });

    it('returns to page 1 when the sort column changes', () => {
      component.onSortChange({active: 'city', direction: 'asc'});

      expect(lastNavigatedQueryParams()).toEqual(
        jasmine.objectContaining({page: 0, sort: 'city,asc'}));
    });

    it('returns to page 1 when the sort direction changes', () => {
      component.onSortChange({active: 'name', direction: 'desc'});

      expect(lastNavigatedQueryParams()).toEqual(
        jasmine.objectContaining({page: 0, sort: 'name,desc'}));
    });

    it('returns to page 1 when the page size changes', () => {
      component.onPageChange({pageIndex: 3, pageSize: 20, length: 100});

      expect(lastNavigatedQueryParams()).toEqual(
        jasmine.objectContaining({page: 0, size: 20}));
    });

    it('returns to page 1 when a search is issued', () => {
      component.searchByLastName('Potter');

      expect(lastNavigatedQueryParams()).toEqual(
        jasmine.objectContaining({page: 0, lastName: 'Potter'}));
    });

    it('keeps the requested page when only the pager navigates', () => {
      component.onPageChange({pageIndex: 4, pageSize: 10, length: 100});

      expect(lastNavigatedQueryParams()).toEqual(
        jasmine.objectContaining({page: 4, size: 10}));
    });
  });

  describe('view state is addressable via the query parameters', () => {

    it('reads page, size, sort and search back from the query parameters', () => {
      route.setQueryParams({lastName: 'Potter', page: '2', size: '20', sort: 'city,desc'});
      fixture.detectChanges();

      expect(getOwnersSpy).toHaveBeenCalledWith(
        {lastName: 'Potter', page: 2, size: 20, sort: 'city,desc'});
      expect(component.searchTerm).toBe('Potter');
      expect(component.sortActive).toBe('city');
      expect(component.sortDirection).toBe('desc');
    });

    it('falls back to the defaults for an unsupported size or a negative page', () => {
      route.setQueryParams({page: '-3', size: '7'});
      fixture.detectChanges();

      expect(getOwnersSpy).toHaveBeenCalledWith(
        {lastName: '', page: 0, size: 10, sort: 'name,asc'});
    });

    it('writes the whole view state to the query parameters', () => {
      fixture.detectChanges();
      navigateSpy.calls.reset();

      component.onSortChange({active: 'petCount', direction: 'desc'});

      expect(lastNavigatedQueryParams()).toEqual(
        {lastName: '', page: 0, size: 10, sort: 'petCount,desc'});
    });

    it('replaces the history entry for sort and page changes so Back leaves the grid', () => {
      fixture.detectChanges();

      component.onSortChange({active: 'city', direction: 'asc'});
      expect(lastNavigateExtras().replaceUrl).toBe(true);

      component.onPageChange({pageIndex: 2, pageSize: 10, length: 100});
      expect(lastNavigateExtras().replaceUrl).toBe(true);
    });

    it('pushes a history entry for a search', () => {
      fixture.detectChanges();

      component.searchByLastName('Potter');

      expect(lastNavigateExtras().replaceUrl).toBe(false);
    });
  });

  describe('the most recent request determines what is displayed', () => {

    it('ignores an earlier response arriving after a newer one', () => {
      const firstResponse = new Subject<OwnerPage>();
      const secondResponse = new Subject<OwnerPage>();
      getOwnersSpy.and.returnValues(firstResponse, secondResponse);

      fixture.detectChanges();                        // issues the initial full-list request
      route.setQueryParams({lastName: 'Potter'});     // issues the search while it is pending

      secondResponse.next(pageOf([potter]));
      firstResponse.next(pageOf([franklin]));         // the stale full list, arriving late

      expect(component.owners.map(owner => owner.lastName)).toEqual(['Potter']);
    });
  });

  describe('empty and failed results are distinguishable', () => {

    it('reports a search that matched nothing, naming the term and retaining it', () => {
      getOwnersSpy.and.returnValue(of(pageOf([], 0)));
      route.setQueryParams({lastName: 'Zzz'});
      fixture.detectChanges();

      expect(component.noSearchMatches).toBe(true);
      expect(component.noOwnersAtAll).toBe(false);
      expect(component.loadFailed).toBe(false);
      expect(component.searchTerm).toBe('Zzz');
      const message = fixture.debugElement.query(By.css('[data-testid="owners-no-matches"]'));
      expect(message.nativeElement.textContent).toContain('Zzz');
    });

    it('reports an empty database distinctly from a fruitless search', () => {
      getOwnersSpy.and.returnValue(of(pageOf([], 0)));
      fixture.detectChanges();

      expect(component.noOwnersAtAll).toBe(true);
      expect(component.noSearchMatches).toBe(false);
      expect(fixture.debugElement.query(By.css('[data-testid="owners-empty"]'))).toBeTruthy();
    });

    it('never renders a failed request as an empty result', () => {
      getOwnersSpy.and.returnValue(throwError(new Error('boom')));
      fixture.detectChanges();

      expect(component.loadFailed).toBe(true);
      expect(component.noOwnersAtAll).toBe(false);
      expect(component.noSearchMatches).toBe(false);
      expect(fixture.debugElement.query(By.css('[data-testid="owners-error"]'))).toBeTruthy();
      expect(fixture.debugElement.query(By.css('[data-testid="owners-empty"]'))).toBeNull();
    });

    it('keeps loading after a failure', () => {
      getOwnersSpy.and.returnValue(throwError(new Error('boom')));
      fixture.detectChanges();

      getOwnersSpy.and.returnValue(of(pageOf([franklin])));
      route.setQueryParams({lastName: 'Fr'});

      expect(component.loadFailed).toBe(false);
      expect(component.owners).toEqual([franklin]);
    });

    it('offers a way back to page 1 when the page index is past the end', () => {
      getOwnersSpy.and.returnValue(of(pageOf([], 12, 500, 10)));
      route.setQueryParams({page: '500'});
      fixture.detectChanges();

      expect(component.pageIsPastTheEnd).toBe(true);
      const link = fixture.debugElement.query(By.css('[data-testid="owners-first-page"]'));
      expect(link).toBeTruthy();

      navigateSpy.calls.reset();
      component.goToFirstPage();
      expect(lastNavigatedQueryParams()).toEqual(jasmine.objectContaining({page: 0}));
    });
  });

  describe('the Pets column', () => {

    it('shows the count alongside the names', () => {
      fixture.detectChanges();

      const cell = fixture.debugElement.query(By.css('td.ownerPets')).nativeElement;
      expect(cell.textContent).toContain('1');
      expect(cell.textContent).toContain('Leo');
    });

    it('shows an explicit 0 for an owner with no pets', () => {
      getOwnersSpy.and.returnValue(of(pageOf([potter])));
      fixture.detectChanges();

      const count = fixture.debugElement.query(By.css('[data-testid="pet-count"]')).nativeElement;
      expect(count.textContent.trim()).toBe('0');
    });
  });

  it('keeps the Add Owner control reachable when nothing is displayed', () => {
    getOwnersSpy.and.returnValue(of(pageOf([], 0)));
    route.setQueryParams({lastName: 'Zzz'});
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#addOwner'))).toBeTruthy();
  });

  it('leaves Address and Telephone without a sort control', () => {
    fixture.detectChanges();

    const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
      .map(th => th.attributes['data-testid']);
    expect(sortable).toEqual(['sort-name', 'sort-city', 'sort-petCount']);
  });
});
