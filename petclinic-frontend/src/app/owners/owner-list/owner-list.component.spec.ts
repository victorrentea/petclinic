import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { MatPaginator } from '@angular/material/paginator';
import { Observable, of, Subject, throwError } from 'rxjs';
import Spy = jasmine.Spy;

import { OwnerListComponent } from './owner-list.component';
import { OwnerService } from '../owner.service';
import { OwnersModule } from '../owners.module';
import { Owner } from '../owner';
import { OwnerPage, OwnerPageQuery } from '../owner-page';
import { DummyComponent } from '../../testing/dummy.component';

class OwnerServiceStub {
  getOwnerPage(query?: Partial<OwnerPageQuery>): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let getOwnerPageSpy: Spy;

  const george: Owner = {
    id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  };
  const betty: Owner = {...george, id: 2, firstName: 'Betty', lastName: 'Davis'};
  const page = (content: Owner[], totalElements = content.length): OwnerPage => ({content, totalElements});

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule.withRoutes([
        {path: 'owners/add', component: DummyComponent},
        {path: 'owners/:id', component: DummyComponent}])],
      providers: [{provide: OwnerService, useClass: OwnerServiceStub}]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    getOwnerPageSpy = spyOn(TestBed.inject(OwnerService), 'getOwnerPage')
      .and.returnValue(of(page([george, betty], 26)));
  });

  function lastQuery(): OwnerPageQuery {
    return getOwnerPageSpy.calls.mostRecent().args[0];
  }

  function render() {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function paginator(): MatPaginator {
    return fixture.debugElement.query(By.directive(MatPaginator)).componentInstance;
  }

  function submitSearch(lastName: string) {
    component.draftLastName = lastName;
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('#search-owner-form button[type=submit]');
    button.click();
  }

  describe('initial state', () => {
    it('loads page 0 of 10 by Name ascending, once', () => {
      render();

      expect(getOwnerPageSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'name,asc'});
    });

    it('renders rows, owner links, range and total', () => {
      const el = render();

      expect(Array.from(el.querySelectorAll('.ownerFullName')).map(td => td.textContent.trim()))
        .toEqual(['George Franklin', 'Betty Davis']);
      expect(el.querySelector('.ownerFullName a').getAttribute('href')).toBe('/owners/1');
      expect(el.querySelector('.mat-mdc-paginator-range-label').textContent).toContain('1 – 10 of 26');
    });

    it('offers sizes 5, 10, 20 and sorting only on Name and City', () => {
      const el = render();

      expect(paginator().pageSizeOptions).toEqual([5, 10, 20]);
      expect(Array.from(el.querySelectorAll('th[mat-sort-header]')).map(th => th.textContent.trim()))
        .toEqual(['Name', 'City']);
      expect(Array.from(el.querySelectorAll('th:not([mat-sort-header])')).map(th => th.textContent.trim()))
        .toEqual(['Address', 'Telephone', 'Pets']);
    });

    it('keeps Add Owner available', () => {
      const el = render();

      expect(el.querySelector('#add-owner')).toBeTruthy();
    });
  });

  describe('one request per action', () => {
    beforeEach(() => {
      render();
      getOwnerPageSpy.calls.reset();
    });

    it('next page keeps filter, size and sort', () => {
      (fixture.nativeElement.querySelector('.mat-mdc-paginator-navigation-next') as HTMLButtonElement).click();

      expect(getOwnerPageSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual({lastName: '', page: 1, size: 10, sort: 'name,asc'});
    });

    it('previous page goes back', () => {
      component.onPage({pageIndex: 2, previousPageIndex: 1, pageSize: 10, length: 26});
      render();
      getOwnerPageSpy.calls.reset();

      (fixture.nativeElement.querySelector('.mat-mdc-paginator-navigation-previous') as HTMLButtonElement).click();

      expect(getOwnerPageSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery().page).toBe(1);
    });

    it('a page size change resets to page 0', () => {
      component.onPage({pageIndex: 2, previousPageIndex: 1, pageSize: 10, length: 26});
      getOwnerPageSpy.calls.reset();

      component.onPage({pageIndex: 4, previousPageIndex: 2, pageSize: 5, length: 26});

      expect(getOwnerPageSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual({lastName: '', page: 0, size: 5, sort: 'name,asc'});
    });

    it('clicking a sortable header resets to page 0 and alternates direction without clearing', () => {
      component.onPage({pageIndex: 2, previousPageIndex: 1, pageSize: 10, length: 26});
      render();
      getOwnerPageSpy.calls.reset();
      const cityHeader = (): HTMLElement => fixture.nativeElement.querySelector('th[mat-sort-header="city"]');

      cityHeader().click();
      render();
      expect(lastQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'city,asc'});
      cityHeader().click();
      render();
      expect(lastQuery().sort).toBe('city,desc');
      cityHeader().click();
      expect(lastQuery().sort).toBe('city,asc');
      expect(getOwnerPageSpy).toHaveBeenCalledTimes(3);
    });

    it('sorts from the keyboard', () => {
      const nameHeader: HTMLElement = fixture.nativeElement.querySelector('th[mat-sort-header="name"]');

      nameHeader.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', keyCode: 13, bubbles: true}));

      expect(getOwnerPageSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery().sort).toBe('name,desc');
    });

    it('a search sends exactly one request for page 0, keeping the sort', () => {
      component.onSort({active: 'city', direction: 'desc'});
      component.onPage({pageIndex: 2, previousPageIndex: 0, pageSize: 10, length: 26});
      getOwnerPageSpy.calls.reset();

      submitSearch('Fr');

      expect(getOwnerPageSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual({lastName: 'Fr', page: 0, size: 10, sort: 'city,desc'});
    });

    it('navigation uses the submitted prefix, not unsubmitted input', () => {
      submitSearch('Fr');
      component.draftLastName = 'Dav';
      getOwnerPageSpy.calls.reset();

      component.onPage({pageIndex: 1, previousPageIndex: 0, pageSize: 10, length: 26});

      expect(lastQuery().lastName).toBe('Fr');
    });
  });

  describe('latest request wins', () => {
    it('a late initial load does not overwrite a search', () => {
      const initialLoad = new Subject<OwnerPage>();
      getOwnerPageSpy.and.returnValue(initialLoad);
      render();
      getOwnerPageSpy.and.returnValue(of(page([george])));

      submitSearch('Franklin');
      initialLoad.next(page([george, betty], 26));

      expect(component.owners).toEqual([george]);
      expect(component.totalElements).toBe(1);
      expect(initialLoad.observers).toHaveSize(0);
    });

    it('a late error or completion of an older request leaves the newer one untouched', () => {
      const older = new Subject<OwnerPage>();
      const newer = new Subject<OwnerPage>();
      getOwnerPageSpy.and.returnValues(older, newer);
      render();

      component.onPage({pageIndex: 1, previousPageIndex: 0, pageSize: 10, length: 26});
      older.error('stale failure');
      older.complete();

      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeTrue();
      newer.next(page([betty], 26));
      expect(component.loading).toBeFalse();
      expect(component.owners).toEqual([betty]);
    });

    it('leaving the screen cancels the outstanding request', () => {
      const pending = new Subject<OwnerPage>();
      getOwnerPageSpy.and.returnValue(pending);
      render();

      fixture.destroy();

      expect(pending.observers).toHaveSize(0);
    });
  });

  describe('a failed navigation', () => {
    it('keeps the last loaded page on screen and the controls on it, so the click can be retried', () => {
      const nextPage = new Subject<OwnerPage>();
      render();
      getOwnerPageSpy.and.returnValue(nextPage);

      (fixture.nativeElement.querySelector('.mat-mdc-paginator-navigation-next') as HTMLButtonElement).click();
      render();
      nextPage.error('server returned code 503');
      const el = render();

      expect(el.querySelector('#owners-error').textContent).toContain('server returned code 503');
      expect(Array.from(el.querySelectorAll('.ownerFullName')).map(td => td.textContent.trim()))
        .toEqual(['George Franklin', 'Betty Davis']);
      expect(component.query.page).toBe(0);
      expect(paginator().pageIndex).toBe(0);
      expect(el.querySelector('.mat-mdc-paginator-navigation-next')).toBeTruthy();
    });

    it('after a successful empty search, does not repeat "no owners" beside the error', () => {
      getOwnerPageSpy.and.returnValue(of(page([], 0)));
      render();
      getOwnerPageSpy.and.returnValue(throwError('server returned code 500'));

      submitSearch('Zz');
      const el = render();

      expect(el.querySelector('#owners-error')).toBeTruthy();
      expect(el.querySelector('#no-owners')).toBeNull();
    });
  });

  describe('empty results and failures', () => {
    it('zero total shows the no-owners message with the submitted prefix and hides the paginator', () => {
      render();
      getOwnerPageSpy.and.returnValue(of(page([], 0)));
      submitSearch('Zz');
      component.draftLastName = 'edited';
      const el = render();

      expect(el.querySelector('#no-owners').textContent).toContain('"Zz"');
      expect(el.querySelector('mat-paginator')).toBeNull();
      expect(el.querySelector('#add-owner')).toBeTruthy();
    });

    it('an empty page with a nonzero total keeps navigation and claims no "no matches"', () => {
      getOwnerPageSpy.and.returnValue(of(page([], 26)));
      const el = render();

      expect(el.querySelector('#no-owners')).toBeNull();
      expect(el.querySelector('mat-paginator')).toBeTruthy();
    });

    it('a failure shows an explicit error and no no-matches message', () => {
      getOwnerPageSpy.and.returnValue(throwError('server returned code 500'));
      const el = render();

      expect(el.querySelector('#owners-error').textContent).toContain('server returned code 500');
      expect(el.querySelector('#no-owners')).toBeNull();
      expect(el.querySelector('#add-owner')).toBeTruthy();
    });
  });
});
