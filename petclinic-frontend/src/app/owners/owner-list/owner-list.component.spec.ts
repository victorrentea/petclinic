import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {RouterTestingModule} from '@angular/router/testing';
import {MatPaginator} from '@angular/material/paginator';
import {Subject} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerListQuery, OwnerPage} from '../owner-page';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let getOwners: jasmine.Spy;
  /** One per request, in the order they were sent; each answers only when the test says so. */
  let responses: Subject<OwnerPage>[];

  const owner = (id: number, lastName = 'Franklin'): Owner => ({
    id, firstName: 'George' + id, lastName, address: '110 W. Liberty St.', city: 'Madison',
    telephone: '6085551023', pets: []
  });
  const page = (rows: number, totalElements: number, lastName?: string): OwnerPage => ({
    content: Array.from({length: rows}, (_, i) => owner(i + 1, lastName)), totalElements
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DummyComponent],
      imports: [NoopAnimationsModule, OwnersModule,
        RouterTestingModule.withRoutes([{path: 'owners/:id', component: DummyComponent}])],
      providers: [{provide: OwnerService, useValue: jasmine.createSpyObj('OwnerService', ['getOwners'])}]
    }).compileComponents();

    responses = [];
    getOwners = TestBed.inject(OwnerService).getOwners as jasmine.Spy;
    getOwners.and.callFake(() => {
      const response = new Subject<OwnerPage>();
      responses.push(response);
      return response;
    });
    fixture = TestBed.createComponent(OwnerListComponent);
    fixture.detectChanges();
  });

  function answer(response: OwnerPage, request = responses.length - 1) {
    responses[request].next(response);
    responses[request].complete();
    fixture.detectChanges();
  }

  function fail(request = responses.length - 1) {
    responses[request].error('server returned code 500');
    fixture.detectChanges();
  }

  const lastQuery = (): OwnerListQuery => getOwners.calls.mostRecent().args[0];
  const element = (css: string): HTMLElement | null => fixture.nativeElement.querySelector(css);
  const texts = (css: string): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll(css) as NodeListOf<HTMLElement>)
      .map((e) => e.textContent!.trim());
  const paginator = (): MatPaginator => fixture.debugElement.query(By.directive(MatPaginator)).componentInstance;

  /** Every UI action must cost exactly one request: runs it and returns the one it sent. */
  function oneRequestFor(action: () => void): OwnerListQuery {
    const before = getOwners.calls.count();
    action();
    fixture.detectChanges();
    expect(getOwners.calls.count()).withContext('requests sent').toBe(before + 1);
    return lastQuery();
  }

  function click(css: string) {
    element(css)!.click();
  }

  function submitSearch(prefix: string) {
    const input = element('#lastName') as HTMLInputElement;
    input.value = prefix;
    input.dispatchEvent(new Event('input'));
    click('#search-owner-form button[type="submit"]');
  }

  function goToNextPage() {
    oneRequestFor(() => click('.mat-mdc-paginator-navigation-next'));
    answer(page(10, 26));
  }

  describe('initial state', () => {
    it('asks once for the first page of 10 by name ascending', () => {
      expect(getOwners).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'name,asc'});
      expect(element('#addOwner')).withContext('Add Owner while loading').toBeTruthy();
    });

    it('shows the rows, the range and total, and sizes 5, 10 and 20', () => {
      answer(page(10, 26));

      expect(texts('#ownersTable td.ownerFullName').length).toBe(10);
      expect(element('.mat-mdc-paginator-range-label')!.textContent).toContain('1 – 10 of 26');
      expect(paginator().pageSizeOptions).toEqual([5, 10, 20]);
      expect(paginator().pageSize).toBe(10);
    });

    it('offers sorting on Name and City only, Name ascending first', () => {
      answer(page(10, 26));

      expect(texts('#ownersTable th[mat-sort-header]')).toEqual(['Name', 'City']);
      expect(texts('#ownersTable th:not([mat-sort-header])')).toEqual(['Address', 'Telephone', 'Pets']);
      expect(element('th[mat-sort-header="name"]')!.getAttribute('aria-sort')).toBe('ascending');
    });

    it('links every row to the owner detail and keeps Add Owner', () => {
      answer(page(1, 1));

      expect(element('#ownersTable td.ownerFullName a')!.getAttribute('href')).toBe('/owners/1');
      expect(element('#addOwner')).toBeTruthy();
    });
  });

  describe('state transitions', () => {
    beforeEach(() => answer(page(10, 26)));

    it('next page sends one request with the same filter, size and sort', () => {
      const query = oneRequestFor(() => click('.mat-mdc-paginator-navigation-next'));

      expect(query).toEqual({lastName: '', page: 1, size: 10, sort: 'name,asc'});
    });

    it('a page-size change goes back to page 0', () => {
      goToNextPage();

      const query = oneRequestFor(() => paginator()._changePageSize(20));

      expect(query).toEqual({lastName: '', page: 0, size: 20, sort: 'name,asc'});
    });

    it('a sort change goes back to page 0, and toggles direction without ever clearing', () => {
      goToNextPage();

      expect(oneRequestFor(() => click('th[mat-sort-header="city"]')))
        .toEqual({lastName: '', page: 0, size: 10, sort: 'city,asc'});
      answer(page(10, 26));
      expect(oneRequestFor(() => click('th[mat-sort-header="city"]')).sort).toBe('city,desc');
      answer(page(10, 26));
      expect(oneRequestFor(() => click('th[mat-sort-header="city"]')).sort).toBe('city,asc');
    });

    it('a sort header answers the keyboard', () => {
      const enter = new KeyboardEvent('keydown', {key: 'Enter'});
      Object.defineProperty(enter, 'keyCode', {get: () => 13});

      const query = oneRequestFor(() => element('th[mat-sort-header="name"]')!.dispatchEvent(enter));

      expect(query.sort).toBe('name,desc');
    });

    it('a search goes back to page 0 and keeps the sort', () => {
      oneRequestFor(() => click('th[mat-sort-header="city"]'));
      answer(page(10, 26));
      oneRequestFor(() => click('th[mat-sort-header="city"]'));
      answer(page(10, 26));
      goToNextPage();

      const query = oneRequestFor(() => submitSearch('Da'));

      expect(query).toEqual({lastName: 'Da', page: 0, size: 10, sort: 'city,desc'});
    });

    it('paging keeps the submitted prefix, not what is typed since', () => {
      oneRequestFor(() => submitSearch('Fr'));
      answer(page(10, 26));
      const input = element('#lastName') as HTMLInputElement;
      input.value = 'Zz';
      input.dispatchEvent(new Event('input'));

      const query = oneRequestFor(() => click('.mat-mdc-paginator-navigation-next'));

      expect(query.lastName).toBe('Fr');
    });
  });

  describe('latest request wins', () => {
    it('a late answer to the initial load does not overwrite a search', () => {
      oneRequestFor(() => submitSearch('Davis'));
      answer(page(2, 2, 'Davis'));

      answer(page(10, 26), 0);

      expect(texts('#ownersTable td.ownerFullName')).toEqual(['George1 Davis', 'George2 Davis']);
      expect(element('.mat-mdc-paginator-range-label')!.textContent).toContain('of 2');
    });

    it('a late failure of an older request shows no error and keeps loading the newer one', () => {
      oneRequestFor(() => submitSearch('Davis'));

      fail(0);

      expect(element('#ownersError')).toBeNull();
      expect(fixture.componentInstance.loading).toBe(true);
      answer(page(2, 2, 'Davis'));
      expect(fixture.componentInstance.loading).toBe(false);
    });

    it('leaving the screen cancels the request in flight', () => {
      fixture.destroy();

      expect(responses[0].observers.length).toBe(0);
    });
  });

  describe('empty results and failures', () => {
    it('no match: names the submitted prefix and hides the paginator', () => {
      answer(page(10, 26));
      oneRequestFor(() => submitSearch('Zz'));
      answer(page(0, 0));

      expect(element('#ownersEmpty')!.textContent).toContain('"Zz"');
      expect(element('mat-paginator')).toBeNull();
      expect(element('#ownersError')).toBeNull();
    });

    it('an empty page of a non-empty result keeps navigation and claims no "no match"', () => {
      answer(page(10, 26));
      oneRequestFor(() => click('.mat-mdc-paginator-navigation-next'));
      answer(page(0, 8)); // owners deleted meanwhile: page 1 no longer exists, but 8 still match

      expect(element('#ownersEmpty')).toBeNull();
      expect(element('#ownersTable')!.textContent).toContain('This page is empty');
      expect(paginator().hasPreviousPage()).toBe(true);
    });

    it('a failure shows an explicit error, never a "no match", and keeps Add Owner', () => {
      fail();

      expect(element('#ownersError')).toBeTruthy();
      expect(element('#ownersEmpty')).toBeNull();
      expect(element('#ownersTable')).toBeNull();
      expect(element('#addOwner')).toBeTruthy();
    });

    it('the search form still works after a failure', () => {
      fail();

      oneRequestFor(() => submitSearch('Fr'));
      answer(page(1, 1));

      expect(element('#ownersError')).toBeNull();
      expect(texts('#ownersTable td.ownerFullName').length).toBe(1);
    });
  });
});
