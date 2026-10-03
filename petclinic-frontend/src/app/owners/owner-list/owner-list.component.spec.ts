import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {RouterTestingModule} from '@angular/router/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {HarnessLoader, TestKey} from '@angular/cdk/testing';
import {MatPaginatorHarness} from '@angular/material/paginator/testing';
import {MatSortHeaderHarness} from '@angular/material/sort/testing';
import {Observable, of, Subject, throwError} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnersModule} from '../owners.module';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerPageQuery} from '../owner-page';
import Spy = jasmine.Spy;

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let loader: HarnessLoader;
  let getOwnerPage: Spy<(query?: OwnerPageQuery) => Observable<OwnerPage>>;

  const owner = (id: number, lastName = 'Franklin'): Owner => ({
    id, firstName: 'George', lastName, address: '110 W. Liberty St.', city: 'Madison',
    telephone: '6085551023', pets: []
  });
  const pageOf = (count: number, totalElements: number): OwnerPage => ({
    content: Array.from({length: count}, (_, i) => owner(i + 1)),
    totalElements
  });
  const FIRST_PAGE: OwnerPageQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};

  beforeEach(async () => {
    const ownerService = {getOwnerPage: () => of(pageOf(10, 26))};
    await TestBed.configureTestingModule({
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{provide: OwnerService, useValue: ownerService}]
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    loader = TestbedHarnessEnvironment.loader(fixture);
    getOwnerPage = spyOn(ownerService, 'getOwnerPage').and.callThrough();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent;
  const rows = () => fixture.debugElement.queryAll(By.css('tbody tr.owner-row'));
  const noOwnersMessage = () => fixture.debugElement.query(By.css('#noOwners'));
  const errorAlert = () => fixture.debugElement.query(By.css('#ownersError'));
  const paginator = () => fixture.debugElement.query(By.css('mat-paginator'));
  const addOwnerButton = () => fixture.debugElement.query(By.css('#addOwner'));
  const lastQuery = () => getOwnerPage.calls.mostRecent().args[0];

  function submitSearch(prefix: string) {
    component.lastName = prefix;
    fixture.debugElement.query(By.css('#search-owner-form button[type=submit]')).nativeElement.click();
    fixture.detectChanges();
  }

  describe('initial state', () => {
    it('requests the first page of 10 by name ascending, once', () => {
      fixture.detectChanges();

      expect(getOwnerPage.calls.allArgs()).toEqual([[FIRST_PAGE]]);
    });

    it('renders the page rows, the range and total, and sizes 5/10/20', async () => {
      fixture.detectChanges();
      const pager = await loader.getHarness(MatPaginatorHarness);

      expect(rows().length).toBe(10);
      expect(await pager.getRangeLabel()).toBe('1 – 10 of 26');
      expect(await pager.getPageSize()).toBe(10);
      expect(component.pageSizes).toEqual([5, 10, 20]);
    });

    it('offers sorting on Name and City only, starting with Name ascending', async () => {
      fixture.detectChanges();
      const headers = await loader.getAllHarnesses(MatSortHeaderHarness);

      expect(await Promise.all(headers.map(h => h.getLabel()))).toEqual(['Name', 'City']);
      expect(await headers[0].getSortDirection()).toBe('asc');
      const headerTexts = fixture.debugElement.queryAll(By.css('thead th'))
        .map(th => th.nativeElement.textContent.trim());
      expect(headerTexts).toEqual(['Name', 'Address', 'City', 'Telephone', 'Pets']);
    });

    it('keeps owner links and Add Owner', () => {
      fixture.detectChanges();

      expect(rows()[0].query(By.css('a')).nativeElement.getAttribute('href')).toBe('/owners/1');
      expect(addOwnerButton()).toBeTruthy();
    });
  });

  describe('one request per action', () => {
    it('next page keeps filter, size and sort', async () => {
      fixture.detectChanges();
      getOwnerPage.calls.reset();

      await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();

      expect(getOwnerPage.calls.allArgs()).toEqual([[{...FIRST_PAGE, page: 1}]]);
    });

    it('previous page goes back one', async () => {
      fixture.detectChanges();
      const pager = await loader.getHarness(MatPaginatorHarness);
      await pager.goToNextPage();
      await pager.goToNextPage();
      getOwnerPage.calls.reset();

      await pager.goToPreviousPage();

      expect(getOwnerPage.calls.allArgs()).toEqual([[{...FIRST_PAGE, page: 1}]]);
    });

    it('a page-size change restarts from page 0', async () => {
      fixture.detectChanges();
      const pager = await loader.getHarness(MatPaginatorHarness);
      await pager.goToNextPage();
      getOwnerPage.calls.reset();

      await pager.setPageSize(20);

      expect(getOwnerPage.calls.allArgs()).toEqual([[{...FIRST_PAGE, size: 20, page: 0}]]);
    });

    it('a sort change restarts from page 0, and toggling never clears the sort', async () => {
      fixture.detectChanges();
      await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();
      const city = await loader.getHarness(MatSortHeaderHarness.with({label: 'City'}));
      getOwnerPage.calls.reset();

      await city.click();
      await city.click();
      await city.click();

      expect(getOwnerPage.calls.allArgs()).toEqual([
        [{...FIRST_PAGE, sort: 'city,asc'}],
        [{...FIRST_PAGE, sort: 'city,desc'}],
        [{...FIRST_PAGE, sort: 'city,asc'}]]);
      expect(await city.getSortDirection()).toBe('asc');
    });

    it('sorts from the keyboard', async () => {
      fixture.detectChanges();
      const name = await loader.getHarness(MatSortHeaderHarness.with({label: 'Name'}));
      getOwnerPage.calls.reset();

      await (await name.host()).sendKeys(TestKey.ENTER);

      expect(getOwnerPage.calls.allArgs()).toEqual([[{...FIRST_PAGE, sort: 'name,desc'}]]);
    });

    it('a search from a later page keeps the sort, restarts from page 0, and is sent once', async () => {
      fixture.detectChanges();
      await (await loader.getHarness(MatSortHeaderHarness.with({label: 'City'}))).click();
      await (await loader.getHarness(MatSortHeaderHarness.with({label: 'City'}))).click();
      await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();
      getOwnerPage.calls.reset();

      submitSearch('Fr');

      expect(getOwnerPage.calls.allArgs()).toEqual([[{lastName: 'Fr', page: 0, size: 10, sort: 'city,desc'}]]);
    });

    it('paging uses the submitted prefix, not the text typed since', async () => {
      fixture.detectChanges();
      submitSearch('Fr');
      component.lastName = 'Dav';
      getOwnerPage.calls.reset();

      await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();

      expect(lastQuery()).toEqual({...FIRST_PAGE, lastName: 'Fr', page: 1});
    });
  });

  describe('latest request wins', () => {
    let initial: Subject<OwnerPage>;
    let latest: Subject<OwnerPage>;

    beforeEach(() => {
      initial = new Subject();
      latest = new Subject();
      getOwnerPage.and.returnValues(initial, latest);
      fixture.detectChanges();
      submitSearch('Franklin');
    });

    it('a late answer to an earlier request is ignored', () => {
      latest.next({content: [owner(7)], totalElements: 1});
      initial.next(pageOf(10, 26));
      fixture.detectChanges();

      expect(component.owners.map(o => o.id)).toEqual([7]);
      expect(component.totalElements).toBe(1);
      expect(component.loading).toBeFalse();
    });

    it('the earlier request cannot end the loading of the latest', () => {
      initial.next(pageOf(10, 26));
      initial.complete();

      expect(component.loading).toBeTrue();
    });

    it('a late failure of an earlier request shows no error', () => {
      initial.error('boom');
      fixture.detectChanges();

      expect(component.errorMessage).toBeFalsy();
      expect(errorAlert()).toBeNull();
    });

    it('leaving the screen cancels the outstanding request', () => {
      fixture.destroy();

      expect(latest.observers.length).toBe(0);
    });
  });

  describe('empty results and failures', () => {
    it('zero matches: message with the submitted prefix, no paginator', () => {
      getOwnerPage.and.returnValue(of({content: [], totalElements: 0}));
      fixture.detectChanges();
      submitSearch('Zzz');
      component.lastName = 'typed later';
      fixture.detectChanges();

      expect(noOwnersMessage().nativeElement.textContent).toContain('"Zzz"');
      expect(paginator()).toBeNull();
      expect(addOwnerButton()).toBeTruthy();
    });

    it('an empty page beyond a nonzero total keeps navigation and claims no "no matches"', async () => {
      getOwnerPage.and.returnValues(of(pageOf(10, 26)), of({content: [], totalElements: 26}));
      fixture.detectChanges();
      const pager = await loader.getHarness(MatPaginatorHarness);

      await pager.goToNextPage();

      expect(rows().length).toBe(0);
      expect(noOwnersMessage()).toBeNull();
      expect(await pager.isPreviousPageDisabled()).toBeFalse();
    });

    it('a failure shows an explicit error, not "no matches"', () => {
      getOwnerPage.and.returnValue(throwError('server returned code 500'));
      fixture.detectChanges();

      expect(errorAlert().nativeElement.textContent).toContain('server returned code 500');
      expect(noOwnersMessage()).toBeNull();
      expect(rows().length).toBe(0);
      expect(addOwnerButton()).toBeTruthy();
      expect(component.loading).toBeFalse();
    });

    it('a later success clears the error', () => {
      getOwnerPage.and.returnValues(throwError('boom'), of(pageOf(3, 3)));
      fixture.detectChanges();

      submitSearch('');

      expect(errorAlert()).toBeNull();
      expect(rows().length).toBe(3);
      expect(text()).not.toContain('boom');
    });
  });
});
