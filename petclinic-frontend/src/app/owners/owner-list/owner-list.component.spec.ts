import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {HarnessLoader, TestKey} from '@angular/cdk/testing';
import {TestbedHarnessEnvironment} from '@angular/cdk/testing/testbed';
import {MatPaginatorHarness} from '@angular/material/paginator/testing';
import {MatSortHarness} from '@angular/material/sort/testing';
import {RouterTestingModule} from '@angular/router/testing';
import {Observable, of, Subject, throwError} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnersModule} from '../owners.module';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerQuery} from '../owner-page';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  getOwners(query?: OwnerQuery): Observable<OwnerPage> {
    return of({content: [], totalElements: 0});
  }
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let loader: HarnessLoader;
  let getOwnersSpy: Spy;

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
  const DEFAULT_QUERY: OwnerQuery = {lastName: '', page: 0, size: 10, sort: 'name,asc'};

  function pageOf(owners: Owner[], totalElements = owners.length): OwnerPage {
    return {content: owners, totalElements};
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function lastQuery(): OwnerQuery {
    return getOwnersSpy.calls.mostRecent().args[0];
  }

  // ngModel inside a form registers its control a microtask after the first change detection
  async function typeLastName(lastName: string) {
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#lastName');
    input.value = lastName;
    input.dispatchEvent(new Event('input'));
  }

  async function submitSearch(lastName: string) {
    await typeLastName(lastName);
    fixture.debugElement.query(By.css('#search-owner-form')).triggerEventHandler('ngSubmit', null);
    fixture.detectChanges();
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{provide: OwnerService, useClass: OwnerServiceStub}]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    loader = TestbedHarnessEnvironment.loader(fixture);
    getOwnersSpy = spyOn(TestBed.inject(OwnerService), 'getOwners')
      .and.returnValue(of(pageOf([george, betty], 26)));
  });

  describe('initial state', () => {
    it('requests the first 10 owners by name, once', () => {
      fixture.detectChanges();

      expect(getOwnersSpy).toHaveBeenCalledOnceWith(DEFAULT_QUERY);
    });

    it('renders the page rows, linking to each owner', () => {
      fixture.detectChanges();

      const names = fixture.debugElement.queryAll(By.css('.ownerFullName a'))
        .map(a => a.nativeElement.textContent.trim());
      expect(names).toEqual(['George Franklin', 'Betty Davis']);
      expect(fixture.nativeElement.querySelector('.ownerFullName a').getAttribute('href')).toBe('/owners/1');
    });

    it('offers page sizes 5, 10 and 20 and shows the range and total', async () => {
      fixture.detectChanges();
      const paginator = await loader.getHarness(MatPaginatorHarness);

      expect(await paginator.getPageSize()).toBe(10);
      expect(await paginator.getRangeLabel()).toBe('1 – 10 of 26');
      await paginator.setPageSize(5); // throws if 5 is not offered
      expect(lastQuery().size).toBe(5);
      await paginator.setPageSize(20);
      expect(lastQuery().size).toBe(20);
    });

    it('lets only Name and City sort, Name ascending first', async () => {
      fixture.detectChanges();
      const sort = await loader.getHarness(MatSortHarness);

      const labels = await Promise.all((await sort.getSortHeaders()).map(h => h.getLabel()));
      expect(labels).toEqual(['Name', 'City']);
      const active = await sort.getActiveHeader();
      expect(await active?.getLabel()).toBe('Name');
      expect(await active?.getSortDirection()).toBe('asc');
      const plainHeaders = fixture.debugElement.queryAll(By.css('th:not([mat-sort-header])'))
        .map(th => th.nativeElement.textContent.trim());
      expect(plainHeaders).toEqual(['Address', 'Telephone', 'Pets']);
    });
  });

  describe('one request per action', () => {
    beforeEach(() => {
      fixture.detectChanges();
      getOwnersSpy.calls.reset();
    });

    it('next and previous page keep filter, size and sort', async () => {
      const paginator = await loader.getHarness(MatPaginatorHarness);

      await paginator.goToNextPage();
      expect(getOwnersSpy).toHaveBeenCalledOnceWith({...DEFAULT_QUERY, page: 1});

      getOwnersSpy.calls.reset();
      await paginator.goToPreviousPage();
      expect(getOwnersSpy).toHaveBeenCalledOnceWith(DEFAULT_QUERY);
    });

    it('a page size change on a later page returns to page 0', async () => {
      const paginator = await loader.getHarness(MatPaginatorHarness);
      await paginator.goToNextPage();
      getOwnersSpy.calls.reset();

      await paginator.setPageSize(20);

      expect(getOwnersSpy).toHaveBeenCalledOnceWith({...DEFAULT_QUERY, size: 20});
    });

    it('a sort change on a later page returns to page 0', async () => {
      const paginator = await loader.getHarness(MatPaginatorHarness);
      await paginator.goToNextPage();
      getOwnersSpy.calls.reset();

      const city = (await (await loader.getHarness(MatSortHarness)).getSortHeaders({label: 'City'}))[0];
      await city.click();

      expect(getOwnersSpy).toHaveBeenCalledOnceWith({...DEFAULT_QUERY, sort: 'city,asc'});
    });

    it('sorting alternates direction and never clears', async () => {
      const name = (await (await loader.getHarness(MatSortHarness)).getSortHeaders({label: 'Name'}))[0];

      await name.click();
      expect(lastQuery().sort).toBe('name,desc');
      await name.click();
      expect(lastQuery().sort).toBe('name,asc');
      expect(getOwnersSpy).toHaveBeenCalledTimes(2);
    });

    it('a sort header can be operated from the keyboard', async () => {
      const city = (await (await loader.getHarness(MatSortHarness)).getSortHeaders({label: 'City'}))[0];

      await (await city.host()).sendKeys(TestKey.ENTER);

      expect(getOwnersSpy).toHaveBeenCalledOnceWith({...DEFAULT_QUERY, sort: 'city,asc'});
    });

    it('a search on a later page keeps the sort and returns to page 0', async () => {
      const city = (await (await loader.getHarness(MatSortHarness)).getSortHeaders({label: 'City'}))[0];
      await city.click();
      await city.click();
      await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();
      getOwnersSpy.calls.reset();

      await submitSearch('Fr');

      expect(getOwnersSpy).toHaveBeenCalledOnceWith({lastName: 'Fr', page: 0, size: 10, sort: 'city,desc'});
    });

    it('clicking Find Owner submits once', async () => {
      await typeLastName('Fr');

      fixture.nativeElement.querySelector('#search-owner-form button[type=submit]').click();

      expect(getOwnersSpy).toHaveBeenCalledOnceWith({...DEFAULT_QUERY, lastName: 'Fr'});
    });

    it('paging uses the submitted filter, not unsubmitted input', async () => {
      await submitSearch('Fr');
      await typeLastName('Da');
      getOwnersSpy.calls.reset();

      await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();

      expect(getOwnersSpy).toHaveBeenCalledOnceWith({...DEFAULT_QUERY, lastName: 'Fr', page: 1});
    });
  });

  describe('latest request wins', () => {
    it('a search is not overwritten by the initial load answering late', () => {
      const initialLoad = new Subject<OwnerPage>();
      getOwnersSpy.and.returnValues(initialLoad, of(pageOf([george])));
      fixture.detectChanges();

      component.search();
      initialLoad.next(pageOf([george, betty], 26));

      expect(component.owners).toEqual([george]);
      expect(component.totalElements).toBe(1);
    });

    it('an earlier failure or completion cannot touch the latest request', () => {
      const earlier = new Subject<OwnerPage>();
      const latest = new Subject<OwnerPage>();
      getOwnersSpy.and.returnValues(earlier, latest);
      fixture.detectChanges();
      component.search();

      earlier.error('too late');
      earlier.complete();
      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBe(true);

      latest.next(pageOf([betty]));
      expect(component.loading).toBe(false);
      expect(component.owners).toEqual([betty]);
    });

    it('cancels the outstanding request when the screen is left', () => {
      const pending = new Subject<OwnerPage>();
      getOwnersSpy.and.returnValue(pending);
      fixture.detectChanges();
      expect(pending.observers.length).toBe(1);

      fixture.destroy();

      expect(pending.observers.length).toBe(0);
    });
  });

  describe('empty results and failures', () => {
    it('no matches: names the submitted prefix and hides the paginator', async () => {
      fixture.detectChanges();
      getOwnersSpy.and.returnValue(of(pageOf([])));

      await submitSearch('Zz');

      expect(text()).toContain('No owners with LastName starting with "Zz"');
      expect(fixture.nativeElement.querySelector('mat-paginator')).toBeNull();
    });

    it('an empty page of a nonzero total keeps navigation and claims no "no matches"', async () => {
      getOwnersSpy.and.returnValue(of(pageOf([], 26)));
      fixture.detectChanges();

      expect(text()).not.toContain('No owners with LastName');
      const paginator = await loader.getHarness(MatPaginatorHarness);
      expect(paginator).toBeTruthy();
    });

    it('a failure is reported as such, not as no matches', () => {
      getOwnersSpy.and.returnValue(throwError('server returned code 500'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.alert-danger').textContent)
        .toContain('server returned code 500');
      expect(text()).not.toContain('No owners with LastName');
    });

    it('Add Owner stays available while loading, on no matches and on failure', async () => {
      const addOwnerButton = () => fixture.debugElement.queryAll(By.css('button'))
        .find(b => b.nativeElement.textContent.trim() === 'Add Owner');

      getOwnersSpy.and.returnValue(new Subject<OwnerPage>());
      fixture.detectChanges();
      expect(addOwnerButton()).withContext('loading').toBeTruthy();

      getOwnersSpy.and.returnValue(of(pageOf([])));
      await submitSearch('Zz');
      expect(addOwnerButton()).withContext('no matches').toBeTruthy();

      getOwnersSpy.and.returnValue(throwError('boom'));
      await submitSearch('Fr');
      expect(addOwnerButton()).withContext('failure').toBeTruthy();
    });
  });
});
