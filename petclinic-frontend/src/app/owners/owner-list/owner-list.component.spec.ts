import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HarnessLoader, TestKey } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatPaginator } from '@angular/material/paginator';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { MatSortHeaderHarness } from '@angular/material/sort/testing';
import { Subject } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { OwnerListComponent } from './owner-list.component';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { OwnerListQuery, OwnerPage } from '../owner-page';
import { OwnersModule } from '../owners.module';
import { DummyComponent } from '../../testing/dummy.component';

interface SentRequest {
  query: OwnerListQuery;
  response: Subject<OwnerPage>;
}

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let loader: HarnessLoader;
  let requests: SentRequest[];

  const owner = (id: number, lastName = 'Franklin'): Owner => ({
    id, firstName: 'George', lastName, address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  });
  const tenOwners = Array.from({ length: 10 }, (_, i) => owner(i + 1));

  beforeEach(waitForAsync(() => {
    requests = [];
    const ownerService = {
      getOwners: (query: OwnerListQuery) => {
        const response = new Subject<OwnerPage>();
        requests.push({ query, response });
        return response;
      }
    };
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [OwnersModule, NoopAnimationsModule,
        RouterTestingModule.withRoutes([{ path: 'owners/:id', component: DummyComponent }])],
      providers: [{ provide: OwnerService, useValue: ownerService }]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    loader = TestbedHarnessEnvironment.loader(fixture);
    fixture.detectChanges();
  });

  function respond(request: SentRequest, page: OwnerPage) {
    request.response.next(page);
    request.response.complete();
    fixture.detectChanges();
  }

  function last(): SentRequest {
    return requests[requests.length - 1];
  }

  function text(selector: string): string | null {
    const element = fixture.debugElement.query(By.css(selector));
    return element ? element.nativeElement.textContent : null;
  }

  async function onLaterPage() {
    respond(requests[0], { content: tenOwners, totalElements: 26 });
    await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();
    respond(last(), { content: tenOwners, totalElements: 26 });
  }

  describe('initial load', () => {
    it('requests the first page of 10 sorted by name, with no filter', () => {
      expect(requests.map(r => r.query)).toEqual([{ lastName: '', page: 0, size: 10, sort: 'name,asc' }]);
    });

    it('shows the rows, the range and the total', async () => {
      respond(requests[0], { content: tenOwners, totalElements: 26 });

      expect(fixture.debugElement.queryAll(By.css('.ownerFullName')).length).toBe(10);
      expect(text('.ownerFullName')).toContain('George Franklin');
      expect(await (await loader.getHarness(MatPaginatorHarness)).getRangeLabel()).toBe('1 – 10 of 26');
    });

    it('offers page sizes 5, 10 and 20', () => {
      respond(requests[0], { content: tenOwners, totalElements: 26 });

      const paginator: MatPaginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance;
      expect(paginator.pageSizeOptions).toEqual([5, 10, 20]);
      expect(paginator.pageSize).toBe(10);
    });

    it('keeps the owner links and Add Owner', () => {
      respond(requests[0], { content: [owner(7)], totalElements: 1 });

      expect(fixture.debugElement.query(By.css('.ownerFullName a')).attributes['href']).toBe('/owners/7');
      expect(text('#addOwner')).toContain('Add Owner');
    });
  });

  describe('navigation', () => {
    it('the next page is exactly one request with the same filter, size and sort', async () => {
      await onLaterPage();

      expect(requests.length).toBe(2);
      expect(last().query).toEqual({ lastName: '', page: 1, size: 10, sort: 'name,asc' });
    });

    it('a page size change goes back to the first page', async () => {
      await onLaterPage();

      await (await loader.getHarness(MatPaginatorHarness)).setPageSize(20);

      expect(requests.length).toBe(3);
      expect(last().query).toEqual({ lastName: '', page: 0, size: 20, sort: 'name,asc' });
    });

    it('sorting goes back to the first page and keeps the submitted filter', async () => {
      component.lastName = 'Fr';
      component.search();
      respond(last(), { content: tenOwners, totalElements: 26 });
      await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();
      respond(last(), { content: tenOwners, totalElements: 26 });

      await (await loader.getHarness(MatSortHeaderHarness.with({ label: 'City' }))).click();

      expect(last().query).toEqual({ lastName: 'Fr', page: 0, size: 10, sort: 'city,asc' });
    });

    it('a sortable header flips its direction and never clears it', async () => {
      const name = await loader.getHarness(MatSortHeaderHarness.with({ label: 'Name' }));

      await name.click();
      await name.click();

      expect(requests.slice(1).map(r => r.query.sort)).toEqual(['name,desc', 'name,asc']);
    });

    it('sorts from the keyboard', async () => {
      const city = await loader.getHarness(MatSortHeaderHarness.with({ label: 'City' }));

      await (await city.host()).sendKeys(TestKey.ENTER);

      expect(last().query.sort).toBe('city,asc');
    });

    it('only Name and City can be sorted', async () => {
      const headers = await loader.getAllHarnesses(MatSortHeaderHarness);

      expect(await Promise.all(headers.map(h => h.getLabel()))).toEqual(['Name', 'City']);
      const plainHeaders = fixture.debugElement.queryAll(By.css('th:not([mat-sort-header])'))
        .map(th => th.nativeElement.textContent.trim());
      expect(plainHeaders).toEqual(['Address', 'Telephone', 'Pets']);
    });
  });

  describe('search', () => {
    it('submitting from a later page sends one request for page 0, keeping the sort', async () => {
      await onLaterPage();
      await (await loader.getHarness(MatSortHeaderHarness.with({ label: 'City' }))).click();
      await (await loader.getHarness(MatSortHeaderHarness.with({ label: 'City' }))).click();
      respond(last(), { content: tenOwners, totalElements: 26 });
      await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();
      const before = requests.length;

      component.lastName = 'Dav';
      fixture.debugElement.query(By.css('#search-owner-form button[type=submit]')).nativeElement.click();

      expect(requests.length).toBe(before + 1);
      expect(last().query).toEqual({ lastName: 'Dav', page: 0, size: 10, sort: 'city,desc' });
    });

    it('paging keeps the submitted filter, not the text typed since', async () => {
      component.lastName = 'Fr';
      component.search();
      respond(last(), { content: tenOwners, totalElements: 26 });

      component.lastName = 'Typed but not submitted';
      await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();

      expect(last().query.lastName).toBe('Fr');
    });
  });

  describe('only the latest request answers', () => {
    it('a late initial load cannot overwrite a search', () => {
      const initialLoad = requests[0];
      component.lastName = 'Davis';
      component.search();
      const search = last();

      respond(search, { content: [owner(2, 'Davis')], totalElements: 1 });
      respond(initialLoad, { content: tenOwners, totalElements: 26 });

      expect(component.owners).toEqual([owner(2, 'Davis')]);
      expect(component.totalElements).toBe(1);
    });

    it('a stale request neither fails nor ends the loading of the latest one', () => {
      const stale = requests[0];
      component.search();

      stale.response.error('boom');
      stale.response.complete();
      fixture.detectChanges();

      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeTrue();
    });

    it('leaving the screen cancels the request in flight', () => {
      const inFlight = requests[0];

      fixture.destroy();

      expect(inFlight.response.observers.length).toBe(0);
    });
  });

  describe('empty results and failures', () => {
    it('no match shows the no-owners message with the submitted prefix and hides the paginator', () => {
      component.lastName = 'Zz';
      component.search();
      component.lastName = 'edited after submitting';
      respond(last(), { content: [], totalElements: 0 });

      expect(text('#noOwners')).toContain('No owners with last name starting with "Zz"');
      expect(fixture.debugElement.query(By.directive(MatPaginator))).toBeNull();
    });

    it('an empty page past the end keeps the paginator and claims no missing owners', () => {
      respond(requests[0], { content: [], totalElements: 26 });

      expect(text('#noOwners')).toBeNull();
      expect(fixture.debugElement.query(By.directive(MatPaginator))).not.toBeNull();
    });

    it('a failure is shown as an error, not as an empty search', () => {
      requests[0].response.error('server returned code 500');
      fixture.detectChanges();

      expect(text('#ownersError')).toContain('server returned code 500');
      expect(text('#noOwners')).toBeNull();
      expect(component.loading).toBeFalse();
      expect(text('#addOwner')).toContain('Add Owner');
    });

    it('the table rebuilt after a no-match search still shows the sort it requests', async () => {
      respond(requests[0], { content: tenOwners, totalElements: 26 });
      const city = await loader.getHarness(MatSortHeaderHarness.with({ label: 'City' }));
      await city.click();
      await city.click();
      component.lastName = 'Zz';
      component.search();
      respond(last(), { content: [], totalElements: 0 });

      component.lastName = 'Fr';
      component.search();
      respond(last(), { content: tenOwners, totalElements: 26 });

      expect(last().query.sort).toBe('city,desc');
      const rebuiltCity = await loader.getHarness(MatSortHeaderHarness.with({ label: 'City' }));
      expect(await rebuiltCity.isActive()).toBeTrue();
      expect(await rebuiltCity.getSortDirection()).toBe('desc');
    });
  });
});
