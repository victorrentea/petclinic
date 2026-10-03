import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {RouterTestingModule} from '@angular/router/testing';
import {MatPaginator} from '@angular/material/paginator';
import {Observable, of, Subject, throwError} from 'rxjs';
import Spy = jasmine.Spy;

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {FIRST_OWNER_PAGE, OwnerPage, OwnerPageQuery} from '../owner-page';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';

class OwnerServiceStub {
  listOwners(query?: OwnerPageQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let listOwnersSpy: Spy;

  const george: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  const betty: Owner = {...george, id: 2, firstName: 'Betty', lastName: 'Davis'};
  const pageOf = (owners: Owner[], totalElements = 26): OwnerPage => ({content: owners, totalElements});

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [OwnersModule, NoopAnimationsModule,
        RouterTestingModule.withRoutes([{path: 'owners/:id', component: DummyComponent}])],
      providers: [{provide: OwnerService, useClass: OwnerServiceStub}]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    listOwnersSpy = spyOn(TestBed.inject(OwnerService), 'listOwners').and.returnValue(of(pageOf([george])));
  });

  const query = (overrides: Partial<OwnerPageQuery>): OwnerPageQuery => ({...FIRST_OWNER_PAGE, ...overrides});
  const lastQuery = (): OwnerPageQuery => listOwnersSpy.calls.mostRecent().args[0];
  const text = (selector: string): string =>
    fixture.debugElement.query(By.css(selector))?.nativeElement.textContent ?? '';
  const exists = (selector: string): boolean => !!fixture.debugElement.query(By.css(selector));
  const paginator = (): MatPaginator => fixture.debugElement.query(By.directive(MatPaginator)).componentInstance;

  // ngModel registers its control asynchronously, so typing must wait for the form to settle
  async function type(lastName: string) {
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.debugElement.query(By.css('#lastName')).nativeElement;
    input.value = lastName;
    input.dispatchEvent(new Event('input'));
  }

  async function typeAndSubmit(lastName: string) {
    await type(lastName);
    fixture.debugElement.query(By.css('#search-owner-form button[type=submit]')).nativeElement.click();
    fixture.detectChanges();
  }

  function clickHeader(name: string) {
    fixture.debugElement.query(By.css(`th[mat-sort-header="${name}"]`)).nativeElement.click();
    fixture.detectChanges();
  }

  describe('initially', () => {
    beforeEach(() => fixture.detectChanges());

    it('asks for the first page of 10 owners by name, once', () => {
      expect(listOwnersSpy.calls.allArgs()).toEqual([[FIRST_OWNER_PAGE]]);
    });

    it('shows the owners with a link to each', () => {
      expect(text('.ownerFullName')).toContain('George Franklin');
      expect(exists('.ownerFullName a[href="/owners/1"]')).toBeTrue();
    });

    it('offers 5, 10 and 20 rows per page, starting at 10, and shows the range and total', () => {
      expect(paginator().pageSizeOptions).toEqual([5, 10, 20]);
      expect(paginator().pageSize).toBe(10);
      expect(text('.mat-mdc-paginator-range-label')).toContain('1 – 10 of 26');
    });

    it('lets only Name and City be sorted, Name ascending first', () => {
      const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
        .map(th => th.attributes['mat-sort-header']);
      expect(sortable).toEqual(['name', 'city']);
      expect(fixture.debugElement.query(By.css('th[mat-sort-header="name"]')).attributes['aria-sort'])
        .toBe('ascending');
    });

    it('offers Add Owner', () => {
      expect(text('#addOwner')).toContain('Add Owner');
    });
  });

  describe('sends exactly one request', () => {
    beforeEach(() => {
      fixture.detectChanges();
      listOwnersSpy.calls.reset();
    });

    it('for the next page, with the applied filter, size and sort', () => {
      fixture.debugElement.query(By.css('.mat-mdc-paginator-navigation-next')).nativeElement.click();

      expect(listOwnersSpy.calls.allArgs()).toEqual([[query({page: 1})]]);
    });

    it('for the previous page', () => {
      component.onPage({pageIndex: 2, previousPageIndex: 1, pageSize: 10, length: 26});
      fixture.detectChanges();
      listOwnersSpy.calls.reset();

      fixture.debugElement.query(By.css('.mat-mdc-paginator-navigation-previous')).nativeElement.click();

      expect(listOwnersSpy.calls.allArgs()).toEqual([[query({page: 1})]]);
    });

    it('back on page 0 for a new page size', () => {
      component.onPage({pageIndex: 2, previousPageIndex: 1, pageSize: 10, length: 26});
      listOwnersSpy.calls.reset();

      component.onPage({pageIndex: 1, previousPageIndex: 2, pageSize: 20, length: 26});

      expect(listOwnersSpy.calls.allArgs()).toEqual([[query({size: 20, page: 0})]]);
    });

    it('back on page 0 when a header is clicked, toggling its direction', () => {
      component.onPage({pageIndex: 2, previousPageIndex: 1, pageSize: 10, length: 26});
      listOwnersSpy.calls.reset();

      clickHeader('name');

      expect(listOwnersSpy.calls.allArgs()).toEqual([[query({sort: 'name,desc', page: 0})]]);
    });

    it('when sorting from the keyboard', () => {
      const city = fixture.debugElement.query(By.css('th[mat-sort-header="city"]')).nativeElement;
      city.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', keyCode: 13} as KeyboardEventInit));

      expect(listOwnersSpy.calls.allArgs()).toEqual([[query({sort: 'city,asc'})]]);
    });

    it('for a submitted search, on page 0, keeping the sort', async () => {
      clickHeader('city');
      clickHeader('city');
      component.onPage({pageIndex: 2, previousPageIndex: 1, pageSize: 10, length: 26});
      listOwnersSpy.calls.reset();

      await typeAndSubmit('Fr');

      expect(listOwnersSpy.calls.allArgs()).toEqual([[query({lastName: 'Fr', sort: 'city,desc', page: 0})]]);
    });

    it('per Enter in the search box', async () => {
      await type('Fr');
      fixture.debugElement.query(By.css('#search-owner-form')).triggerEventHandler('ngSubmit', {});

      expect(listOwnersSpy.calls.allArgs()).toEqual([[query({lastName: 'Fr'})]]);
    });
  });

  it('pages through the submitted search, not the text typed since', async () => {
    fixture.detectChanges();
    await typeAndSubmit('Fr');
    await type('Da');

    component.onPage({pageIndex: 1, previousPageIndex: 0, pageSize: 10, length: 26});

    expect(lastQuery()).toEqual(query({lastName: 'Fr', page: 1}));
  });

  describe('only the latest request answers', () => {
    let initialLoad: Subject<OwnerPage>;

    beforeEach(() => {
      initialLoad = new Subject<OwnerPage>();
      listOwnersSpy.and.returnValues(initialLoad, of(pageOf([george], 1)));
      fixture.detectChanges();
    });

    it('so a late initial load does not overwrite a search', async () => {
      await typeAndSubmit('Franklin');
      initialLoad.next(pageOf([george, betty], 26));
      fixture.detectChanges();

      expect(component.page).toEqual(pageOf([george], 1));
      expect(text('#ownersTable')).not.toContain('Betty');
    });

    it('so a late failure does not show an error', async () => {
      await typeAndSubmit('Franklin');
      initialLoad.error('boom');
      fixture.detectChanges();

      expect(exists('#ownersError')).toBeFalse();
    });

    it('so an earlier request completing does not end the loading of a newer one', async () => {
      const search = new Subject<OwnerPage>();
      listOwnersSpy.and.returnValue(search);
      await typeAndSubmit('Franklin');
      initialLoad.complete();

      expect(component.loading).toBeTrue();
    });

    it('and nothing answers once the screen is left', () => {
      fixture.destroy();

      expect(initialLoad.observers.length).toBe(0);
    });
  });

  it('tells "no owners" for a search that matched none, without a paginator', async () => {
    listOwnersSpy.and.returnValue(of(pageOf([], 0)));
    fixture.detectChanges();
    await typeAndSubmit('Zz');

    expect(text('#noOwners')).toContain('No owners with last name starting with "Zz"');
    expect(exists('mat-paginator')).toBeFalse();
    expect(exists('#ownersError')).toBeFalse();
  });

  it('keeps naming the search that matched none while the next search is in flight', async () => {
    listOwnersSpy.and.returnValue(of(pageOf([], 0)));
    fixture.detectChanges();
    await typeAndSubmit('Zz');
    listOwnersSpy.and.returnValue(new Subject<OwnerPage>());

    await typeAndSubmit('Pot');

    expect(text('#noOwners')).toContain('"Zz"');
  });

  it('keeps the paginator, and does not claim "no owners", on an empty page past the last', () => {
    listOwnersSpy.and.returnValue(of(pageOf([], 26)));
    fixture.detectChanges();

    expect(exists('#noOwners')).toBeFalse();
    expect(exists('mat-paginator')).toBeTrue();
  });

  it('shows an explicit error when the list fails, never "no owners"', () => {
    listOwnersSpy.and.returnValue(throwError('server returned code 500'));
    fixture.detectChanges();

    expect(exists('#ownersError')).toBeTrue();
    expect(exists('#noOwners')).toBeFalse();
    expect(component.loading).toBeFalse();
    expect(text('#addOwner')).toContain('Add Owner');
  });

  it('retries the failed request, once, with the same filter, page, size and sort', () => {
    listOwnersSpy.and.returnValue(throwError('server returned code 500'));
    fixture.detectChanges();
    component.onPage({pageIndex: 2, previousPageIndex: 1, pageSize: 10, length: 26});
    fixture.detectChanges();
    listOwnersSpy.calls.reset();
    listOwnersSpy.and.returnValue(of(pageOf([george])));

    fixture.debugElement.query(By.css('#retryOwners')).nativeElement.click();
    fixture.detectChanges();

    expect(listOwnersSpy.calls.allArgs()).toEqual([[query({page: 2})]]);
    expect(exists('#ownersError')).toBeFalse();
  });
});
