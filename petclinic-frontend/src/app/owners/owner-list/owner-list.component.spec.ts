import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {RouterTestingHarness, RouterTestingModule} from '@angular/router/testing';
import {Observable, of, Subject, throwError} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerPageQuery} from '../owner-page';
import {DesignSystemModule} from '../../design-system/design-system.module';
import {DummyComponent} from '../../testing/dummy.component';
import Spy = jasmine.Spy;

const TOTAL_OWNERS = 26;

function anOwner(id: number): Owner {
  return {
    id, firstName: `Owner${id}`, lastName: 'Franklin', address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  };
}

function pageOf(total: number, query: OwnerPageQuery): OwnerPage {
  const first = query.page * query.size;
  const content = Array.from({length: Math.max(0, Math.min(query.size, total - first))},
    (_, i) => anOwner(first + i + 1));
  const totalPages = Math.ceil(total / query.size);
  return {content, totalElements: total, totalPages, number: query.page, size: query.size};
}

describe('OwnerListComponent', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let getOwnerPage: Spy<(query: OwnerPageQuery) => Observable<OwnerPage>>;

  beforeEach(async () => {
    const ownerService = {getOwnerPage: (query: OwnerPageQuery) => of(pageOf(TOTAL_OWNERS, query))};
    getOwnerPage = spyOn(ownerService, 'getOwnerPage').and.callThrough();
    TestBed.configureTestingModule({
      declarations: [OwnerListComponent, DummyComponent],
      imports: [FormsModule, DesignSystemModule, RouterTestingModule.withRoutes([
        {path: 'owners', component: OwnerListComponent},
        {path: 'owners/add', component: DummyComponent},
        {path: 'owners/:id', component: DummyComponent}
      ])],
      providers: [{provide: OwnerService, useValue: ownerService}]
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  async function open(url: string): Promise<OwnerListComponent> {
    const component = await harness.navigateByUrl(url, OwnerListComponent);
    await settle();
    return component;
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function click(selector: string) {
    query(selector).click();
    await settle();
  }

  function query(selector: string): HTMLElement | null {
    return harness.routeNativeElement!.querySelector(selector);
  }

  function text(selector: string): string {
    return query(selector)?.textContent.replace(/\s+/g, ' ').trim();
  }

  function names(): string[] {
    return Array.from(harness.routeNativeElement!.querySelectorAll('td.ownerFullName'))
      .map(cell => cell.textContent.trim());
  }

  function lastApiQuery(): OwnerPageQuery {
    return getOwnerPage.calls.mostRecent().args[0];
  }

  describe('on opening /owners', () => {
    beforeEach(async () => await open('/owners'));

    it('asks the API for the first page of 10 sorted by name', () => {
      expect(lastApiQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'name,asc'});
      expect(names()).toHaveSize(10);
      expect(names()[0]).toBe('Owner1 Franklin');
    });

    it('shows the range, the total and the page count', () => {
      expect(text('.owners-range')).toBe('Showing 1–10 of 26 owners');
      expect(text('.owners-page-number')).toBe('Page 1 of 3');
    });

    it('marks only the Name header as sorted ascending', () => {
      const headers = harness.routeNativeElement!.querySelectorAll('th');
      expect(headers[0].getAttribute('aria-sort')).toBe('ascending');
      expect(headers[2].hasAttribute('aria-sort')).toBe(false);
    });

    it('offers sorting only on Name and City', () => {
      const sortable = Array.from(harness.routeNativeElement!.querySelectorAll('th button'))
        .map(b => b.textContent.replace(/[▲▼]/g, '').trim());
      expect(sortable).toEqual(['Name', 'City']);
    });

    it('keeps the URL plain while on defaults', () => {
      expect(router.url).toBe('/owners');
    });

    it('disables First and Previous on the first page', () => {
      expect((query('[aria-label="First page"]') as HTMLButtonElement).disabled).toBe(true);
      expect((query('[aria-label="Previous page"]') as HTMLButtonElement).disabled).toBe(true);
      expect((query('[aria-label="Next page"]') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('sorting', () => {
    it('toggles Name to descending on a second click', async () => {
      await open('/owners');

      await click('th:nth-child(1) button');

      expect(router.url).toBe('/owners?sort=name,desc');
      expect(lastApiQuery().sort).toBe('name,desc');
      expect(query('th:nth-child(1)').getAttribute('aria-sort')).toBe('descending');
    });

    it('sorts by another column ascending and returns to page 1', async () => {
      await open('/owners?page=2&sort=name,desc');

      await click('th:nth-child(3) button');

      expect(router.url).toBe('/owners?sort=city,asc');
      expect(lastApiQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'city,asc'});
      expect(query('th:nth-child(3)').getAttribute('aria-sort')).toBe('ascending');
      expect(query('th:nth-child(1)').hasAttribute('aria-sort')).toBe(false);
    });
  });

  describe('page size', () => {
    it('offers 5, 10 and 20 rows', async () => {
      await open('/owners');
      const options = Array.from(harness.routeNativeElement!.querySelectorAll('#ownersPageSize option'))
        .map(o => o.textContent.trim());
      expect(options).toEqual(['5', '10', '20']);
    });

    it('changing it reloads from page 1', async () => {
      await open('/owners?page=3');
      const select = query('#ownersPageSize') as HTMLSelectElement;

      select.value = '2';
      select.dispatchEvent(new Event('change'));
      await settle();

      expect(router.url).toBe('/owners?size=20');
      expect(lastApiQuery()).toEqual({lastName: '', page: 0, size: 20, sort: 'name,asc'});
      expect(text('.owners-range')).toBe('Showing 1–20 of 26 owners');
    });
  });

  describe('page navigation', () => {
    it('Next moves one page on', async () => {
      await open('/owners');

      await click('[aria-label="Next page"]');

      expect(router.url).toBe('/owners?page=2');
      expect(lastApiQuery().page).toBe(1);
      expect(text('.owners-range')).toBe('Showing 11–20 of 26 owners');
    });

    it('Last jumps to the partial last page, where Next and Last are disabled', async () => {
      await open('/owners');

      await click('[aria-label="Last page"]');

      expect(router.url).toBe('/owners?page=3');
      expect(text('.owners-range')).toBe('Showing 21–26 of 26 owners');
      expect((query('[aria-label="Next page"]') as HTMLButtonElement).disabled).toBe(true);
      expect((query('[aria-label="Last page"]') as HTMLButtonElement).disabled).toBe(true);
    });

    it('Previous and First move back', async () => {
      await open('/owners?page=3');

      await click('[aria-label="Previous page"]');
      expect(router.url).toBe('/owners?page=2');

      await click('[aria-label="First page"]');
      expect(router.url).toBe('/owners');
      expect(lastApiQuery().page).toBe(0);
    });
  });

  describe('search', () => {
    it('searches by last-name prefix from page 1, keeping sort and size', async () => {
      await open('/owners?page=3&size=5&sort=city,desc');
      const input = query('#lastName') as HTMLInputElement;

      input.value = 'Fr';
      input.dispatchEvent(new Event('input'));
      await click('#search-owner-form button[type="submit"]');

      expect(router.url).toBe('/owners?lastName=Fr&size=5&sort=city,desc');
      expect(lastApiQuery()).toEqual({lastName: 'Fr', page: 0, size: 5, sort: 'city,desc'});
    });

    it('a search is not overwritten by the initial load answering late', async () => {
      const initialLoad = new Subject<OwnerPage>();
      getOwnerPage.and.returnValues(initialLoad, of(pageOf(1, {lastName: 'Fr', page: 0, size: 10, sort: 'name,asc'})));
      const component = await open('/owners');

      component.searchByLastName('Fr');
      await settle();
      initialLoad.next(pageOf(TOTAL_OWNERS, {lastName: '', page: 0, size: 10, sort: 'name,asc'}));
      harness.detectChanges();

      expect(component.ownerPage.totalElements).toBe(1);
      expect(names()).toEqual(['Owner1 Franklin']);
    });
  });

  describe('the URL', () => {
    it('restores search, page, size and sort from a link', async () => {
      await open('/owners?lastName=Fr&page=2&size=5&sort=city,desc');

      expect(lastApiQuery()).toEqual({lastName: 'Fr', page: 1, size: 5, sort: 'city,desc'});
      expect((query('#lastName') as HTMLInputElement).value).toBe('Fr');
      expect(query('th:nth-child(3)').getAttribute('aria-sort')).toBe('descending');
    });

    it('replaces invalid values with defaults before calling the API', async () => {
      await open('/owners?page=abc&size=7&sort=telephone,asc');

      expect(router.url).toBe('/owners');
      expect(getOwnerPage.calls.count()).toBe(1);
      expect(lastApiQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'name,asc'});
    });

    it('moves a page past the end to the last page', async () => {
      await open('/owners?page=99');

      expect(router.url).toBe('/owners?page=3');
      expect(text('.owners-page-number')).toBe('Page 3 of 3');
    });
  });

  describe('empty and failed results', () => {
    it('says no owner matched the search, without table or pager', async () => {
      getOwnerPage.and.callFake(q => of(pageOf(0, q)));

      await open('/owners?lastName=Zzz');

      expect(text('.owners-empty')).toBe('No owners with last name starting with "Zzz".');
      expect(query('#ownersTable')).toBeNull();
      expect(query('.owners-pagination')).toBeNull();
      expect(text('button.btn:not([type])')).toBe('Add Owner');
    });

    it('says the clinic has no owners when not searching', async () => {
      getOwnerPage.and.callFake(q => of(pageOf(0, q)));

      await open('/owners');

      expect(text('.owners-empty')).toBe('No owners yet.');
    });

    it('reports a failure as an alert, distinct from no matches, and Find retries', async () => {
      getOwnerPage.and.returnValue(throwError(() => 'server returned code 500'));
      await open('/owners?lastName=Fr');

      expect(text('[role="alert"]')).toBe('Could not load owners. Please try again.');
      expect(query('.owners-empty')).toBeNull();
      expect(query('#ownersTable')).toBeNull();

      getOwnerPage.and.callFake(q => of(pageOf(3, q)));
      await click('#search-owner-form button[type="submit"]');

      expect(query('[role="alert"]')).toBeNull();
      expect(names()).toHaveSize(3);
    });
  });

  describe('navigation', () => {
    it('opens an owner from their name', async () => {
      await open('/owners');

      await click('td.ownerFullName a');

      expect(router.url).toBe('/owners/1');
    });

    it('opens the New Owner form', async () => {
      await open('/owners');

      await click('button.btn:not([type])');

      expect(router.url).toBe('/owners/add');
    });
  });
});
