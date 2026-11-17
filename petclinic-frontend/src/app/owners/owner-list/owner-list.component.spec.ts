import {TestBed} from '@angular/core/testing';
import {Location} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {RouterTestingHarness, RouterTestingModule} from '@angular/router/testing';
import {Subject} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {Pet} from '../../pets/pet';
import {OwnerPage, OwnerQuery} from '../owner-page';
import {DesignSystemModule} from '../../design-system/design-system.module';
import {DummyComponent} from '../../testing/dummy.component';

interface PendingRequest {
  query: OwnerQuery;
  response: Subject<OwnerPage>;
}

const owner = (id: number, firstName: string, lastName: string): Owner => ({
  id, firstName, lastName, address: id + ' Main St', city: 'Madison', telephone: '6085551023', pets: []
});
const pageOf = (content: Owner[], number: number, size: number, totalElements: number): OwnerPage =>
  ({content, number, size, totalElements, totalPages: Math.ceil(totalElements / size)});
const franklin = owner(1, 'George', 'Franklin');

describe('OwnerListComponent', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let requests: PendingRequest[];
  let root: HTMLElement;

  beforeEach(() => {
    requests = [];
    const ownerService = {
      getOwnerPage: (query: OwnerQuery) => {
        const request: PendingRequest = {query, response: new Subject<OwnerPage>()};
        requests.push(request);
        return request.response;
      }
    };
    TestBed.configureTestingModule({
      declarations: [OwnerListComponent, DummyComponent],
      imports: [FormsModule, DesignSystemModule, RouterTestingModule.withRoutes([
        {path: 'owners', component: OwnerListComponent},
        {path: 'owners/add', component: DummyComponent},
        {path: 'owners/:id', component: DummyComponent}])],
      providers: [{provide: OwnerService, useValue: ownerService}]
    });
    router = TestBed.inject(Router);
  });

  async function open(url: string): Promise<void> {
    router.setUpLocationChangeListener(); // so that Location.back() is heard, as in a running app
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, OwnerListComponent);
    root = harness.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function respond(index: number, page: OwnerPage): Promise<void> {
    requests[index].response.next(page);
    requests[index].response.complete();
    await settle();
  }

  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const text = (selector: string) => q(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const click = async (selector: string) => {
    q<HTMLElement>(selector)!.click();
    await settle();
  };
  const url = () => TestBed.inject(Location).path();
  const last = () => requests[requests.length - 1].query;

  describe('applied state from the URL', () => {
    it('requests the defaults for a bare /owners and lists names as "Last, First"', async () => {
      await open('/owners');

      expect(requests.length).toBe(1);
      expect(requests[0].query).toEqual(
        {page: 0, size: 10, sortField: 'lastName', sortDirection: 'asc', lastName: ''});
      expect(text('#ownersLoading')).toBe('Loading owners…');

      await respond(0, pageOf([franklin], 0, 10, 1));

      expect(text('td.ownerFullName a')).toBe('Franklin, George');
      expect(q('td.ownerFullName a')!.getAttribute('href')).toBe('/owners/1');
    });

    it('puts the emoji of the pet type before each pet name', async () => {
      await open('/owners');
      const pet = {
        id: 5, name: 'Rex', birthDate: '2020-01-01', ownerId: 1, visits: [], type: {id: 2, name: 'dog'}
      } as Pet;
      const cat = {...pet, id: 6, name: 'Tom', type: {id: 1, name: 'cat'}};
      await respond(0, pageOf([{...franklin, pets: [pet, cat]}], 0, 10, 1));

      const pets = Array.from(root.querySelectorAll('tbody tr td:last-child div'))
        .map(div => div.textContent!.replace(/\s+/g, ' ').trim());
      expect(pets).toEqual(['🐶 Rex', '🐱 Tom']);
    });

    it('requests and shows exactly the state of a deep link, including the filter', async () => {
      await open('/owners?page=2&size=5&sort=city,desc&lastName=Dav');

      expect(last()).toEqual({page: 2, size: 5, sortField: 'city', sortDirection: 'desc', lastName: 'Dav'});
      await respond(0, pageOf([owner(7, 'Betty', 'Davis')], 2, 5, 11));

      expect((q<HTMLInputElement>('#lastName'))!.value).toBe('Dav');
      expect(q('#sort-city')!.parentElement!.getAttribute('aria-sort')).toBe('descending');
      expect(text('#owners-range')).toBe('11-11 of 11');
    });

    it('corrects invalid fields in place, once, with history replacement', async () => {
      const navigate = spyOn(router, 'navigate').and.callThrough();
      await open('/owners?page=-1&size=7&sort=pets,asc&lastName=Dav');
      await settle();

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({replaceUrl: true}));

      expect(url()).toBe('/owners?page=0&size=10&sort=lastName,asc&lastName=Dav');
      expect(requests.length).toBe(1);
      expect(last()).toEqual({page: 0, size: 10, sortField: 'lastName', sortDirection: 'asc', lastName: 'Dav'});

      await respond(0, pageOf([franklin], 0, 10, 1));
      TestBed.inject(Location).back();
      await new Promise(resolve => setTimeout(resolve, 50));
      await settle();
      expect(url()).not.toContain('page=-1');
    });
  });

  describe('changing the applied state', () => {
    beforeEach(async () => {
      await open('/owners?page=3&size=20&sort=city,desc');
      await respond(0, pageOf([franklin], 3, 20, 61));
    });

    it('submitting a filter selects page 0 and keeps sort and size', async () => {
      q<HTMLInputElement>('#lastName')!.value = 'Dav';
      q<HTMLInputElement>('#lastName')!.dispatchEvent(new Event('input'));
      await click('#search-owner-form button[type="submit"]');

      expect(url()).toBe('/owners?page=0&size=20&sort=city,desc&lastName=Dav');
      expect(last()).toEqual({page: 0, size: 20, sortField: 'city', sortDirection: 'desc', lastName: 'Dav'});
    });

    it('Clear empties the box and applies an empty filter on page 0, keeping sort and size', async () => {
      q<HTMLInputElement>('#lastName')!.value = 'Dav';
      q<HTMLInputElement>('#lastName')!.dispatchEvent(new Event('input'));
      await click('#search-owner-form button[type="submit"]');
      await respond(1, pageOf([franklin], 0, 20, 1));

      await click('#clear-filter');

      expect(url()).toBe('/owners?page=0&size=20&sort=city,desc');
      expect(last()).toEqual({page: 0, size: 20, sortField: 'city', sortDirection: 'desc', lastName: ''});
      expect(q<HTMLInputElement>('#lastName')!.value).toBe('');
    });

    it('Enter in the search box submits the form', async () => {
      q<HTMLInputElement>('#lastName')!.value = 'Fr';
      q<HTMLInputElement>('#lastName')!.dispatchEvent(new Event('input'));
      q<HTMLFormElement>('#search-owner-form')!.dispatchEvent(new Event('submit'));
      await settle();

      expect(last().lastName).toBe('Fr');
      expect(last().page).toBe(0);
    });

    it('an unsubmitted search does not change the applied filter, and survives paging', async () => {
      q<HTMLInputElement>('#lastName')!.value = 'Typed';
      q<HTMLInputElement>('#lastName')!.dispatchEvent(new Event('input'));

      await click('#previous-page');

      expect(last()).toEqual({page: 2, size: 20, sortField: 'city', sortDirection: 'desc', lastName: ''});
      expect(q<HTMLInputElement>('#lastName')!.value).toBe('Typed');
    });

    it('a new sort column starts ascending, a repeat toggles, both back on page 0', async () => {
      await click('#sort-lastName');
      expect(last()).toEqual({page: 0, size: 20, sortField: 'lastName', sortDirection: 'asc', lastName: ''});
      await respond(1, pageOf([franklin], 0, 20, 61));
      expect(q('#sort-lastName')!.parentElement!.getAttribute('aria-sort')).toBe('ascending');
      expect(q('#sort-city')!.parentElement!.getAttribute('aria-sort')).toBe('none');

      await click('#sort-lastName');
      expect(last().sortDirection).toBe('desc');
      await respond(2, pageOf([franklin], 0, 20, 61));
      expect(q('#sort-lastName')!.parentElement!.getAttribute('aria-sort')).toBe('descending');
    });

    it('changing the page size selects page 0 and keeps sort and filter', async () => {
      const select = q<HTMLSelectElement>('app-combo select')!;
      select.value = '0'; // option index of 5
      select.dispatchEvent(new Event('change'));
      await settle();

      expect(last()).toEqual({page: 0, size: 5, sortField: 'city', sortDirection: 'desc', lastName: ''});
    });

    it('Back returns to the previous applied state', async () => {
      await click('#previous-page');
      await respond(1, pageOf([franklin], 2, 20, 61));

      TestBed.inject(Location).back();
      await new Promise(resolve => setTimeout(resolve, 50)); // the router reacts to popstate asynchronously
      await settle();

      expect(url()).toBe('/owners?page=3&size=20&sort=city,desc');
      expect(last().page).toBe(3);
    });
  });

  describe('range and boundary controls', () => {
    it('shows 11-20 of 23 in the middle, with every control enabled', async () => {
      await open('/owners?page=1');
      await respond(0, pageOf(Array.from({length: 10}, (_, i) => owner(i, 'A', 'B')), 1, 10, 23));

      expect(text('#owners-range')).toBe('11-20 of 23');
      ['#first-page', '#previous-page', '#next-page', '#last-page']
        .forEach(id => expect(q<HTMLButtonElement>(id)!.disabled).toBe(false));
    });

    it('shows 21-23 of 23 on the last page, with next and last disabled', async () => {
      await open('/owners?page=2');
      await respond(0, pageOf([owner(1, 'A', 'B'), owner(2, 'A', 'B'), owner(3, 'A', 'B')], 2, 10, 23));

      expect(text('#owners-range')).toBe('21-23 of 23');
      expect(q<HTMLButtonElement>('#next-page')!.disabled).toBe(true);
      expect(q<HTMLButtonElement>('#last-page')!.disabled).toBe(true);
      expect(q<HTMLButtonElement>('#first-page')!.disabled).toBe(false);
    });

    it('shows 0-0 of 0 with all navigation disabled when nothing matches', async () => {
      await open('/owners');
      await respond(0, pageOf([], 0, 10, 0));

      expect(text('#owners-range')).toBe('0-0 of 0');
      ['#first-page', '#previous-page', '#next-page', '#last-page']
        .forEach(id => expect(q<HTMLButtonElement>(id)!.disabled).toBe(true));
    });

    it('last jumps to the final page', async () => {
      await open('/owners');
      await respond(0, pageOf(Array.from({length: 10}, (_, i) => owner(i, 'A', 'B')), 0, 10, 23));

      await click('#last-page');

      expect(last().page).toBe(2);
    });
  });

  describe('request lifecycle', () => {
    it('an earlier response cannot overwrite a later one nor end its loading state', async () => {
      await open('/owners?lastName=A');
      q<HTMLInputElement>('#lastName')!.value = 'B';
      q<HTMLInputElement>('#lastName')!.dispatchEvent(new Event('input'));
      await click('#search-owner-form button[type="submit"]');
      expect(requests.length).toBe(2);

      await respond(0, pageOf([owner(1, 'Old', 'Answer')], 0, 10, 1));
      expect(text('#ownersLoading')).toBe('Loading owners…');
      expect(q('td.ownerFullName')).toBeNull();

      await respond(1, pageOf([owner(2, 'New', 'Answer')], 0, 10, 1));
      expect(text('td.ownerFullName a')).toBe('Answer, New');
      expect(q('#ownersLoading')).toBeNull();
    });

    it('keeps the previous rows, dimmed and inert, until the next page replaces them', async () => {
      await open('/owners');
      await respond(0, pageOf([franklin], 0, 10, 23));

      await click('#next-page');

      expect(q('#ownersTable')!.classList).toContain('refreshing');
      expect(q('#ownersTable')!.getAttribute('aria-busy')).toBe('true');
      expect(text('td.ownerFullName a')).toBe('Franklin, George');
      expect(text('#ownersLoading')).toBe('Loading owners…');
      expect(q<HTMLButtonElement>('#next-page')!.disabled).toBe(true);

      await respond(1, pageOf([owner(2, 'Betty', 'Davis')], 1, 10, 23));

      expect(q('#ownersTable')!.classList).not.toContain('refreshing');
      expect(text('td.ownerFullName a')).toBe('Davis, Betty');
      expect(q('#ownersLoading')).toBeNull();
    });

    it('drops the previous rows when the new request fails', async () => {
      await open('/owners');
      await respond(0, pageOf([franklin], 0, 10, 23));

      await click('#next-page');
      requests[1].response.error('down');
      await settle();

      expect(q('td.ownerFullName')).toBeNull();
      expect(q('#ownersError')).not.toBeNull();
    });

    it('leaving the page cancels the request in flight', async () => {
      await open('/owners');
      expect(requests[0].response.observers.length).toBe(1);

      harness.fixture.destroy();

      expect(requests[0].response.observers.length).toBe(0);
    });

    it('shows an error with Retry instead of an empty result, and Retry repeats the same criteria', async () => {
      await open('/owners?page=1&sort=city,asc&lastName=Dav');
      requests[0].response.error('server returned code 500');
      await settle();

      expect(text('#ownersError')).toContain('server returned code 500');
      expect(q('#noOwners')).toBeNull();
      expect(q('#add-owner')).not.toBeNull();

      await click('#retry');

      expect(requests.length).toBe(2);
      expect(requests[1].query).toEqual(requests[0].query);
      expect(url()).toBe('/owners?page=1&sort=city,asc&lastName=Dav');
      await respond(1, pageOf([franklin], 1, 10, 11));
      expect(q('#ownersError')).toBeNull();
    });

    it('keeps reacting to navigation after a failed request', async () => {
      await open('/owners');
      requests[0].response.error('down');
      await settle();

      await router.navigateByUrl('/owners?size=5');
      await settle();

      expect(last().size).toBe(5);
    });
  });

  describe('empty results', () => {
    it('distinguishes an empty register from a filter without matches, and keeps Add Owner', async () => {
      await open('/owners');
      await respond(0, pageOf([], 0, 10, 0));
      expect(text('#noOwners')).toBe('No owners are registered yet.');
      expect(q('#add-owner')).not.toBeNull();

      await router.navigateByUrl('/owners?lastName=Zzz');
      await respond(1, pageOf([], 0, 10, 0));
      expect(text('#noOwners')).toBe('No owners with last name starting with "Zzz".');
      expect(q('#add-owner')).not.toBeNull();
    });
  });

  describe('a page that disappeared', () => {
    it('moves to the last available page with history replacement and displays it', async () => {
      const navigate = spyOn(router, 'navigate').and.callThrough();
      await open('/owners?page=2');
      await respond(0, pageOf([], 2, 10, 20));

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({replaceUrl: true}));
      expect(url()).toBe('/owners?page=1&size=10&sort=lastName,asc');
      expect(requests.length).toBe(2);
      expect(last().page).toBe(1);
      expect(q('td.ownerFullName')).toBeNull();

      await respond(1, pageOf(Array.from({length: 10}, (_, i) => owner(i, 'A', 'B')), 1, 10, 20));
      expect(text('#owners-range')).toBe('11-20 of 20');
    });

    it('settles on page 0 without looping when nothing matches any more', async () => {
      await open('/owners?page=4');
      await respond(0, pageOf([], 4, 10, 0));
      await respond(1, pageOf([], 0, 10, 0));
      await settle();

      expect(requests.length).toBe(2);
      expect(last().page).toBe(0);
      expect(text('#noOwners')).toBeTruthy();
    });
  });

  describe('grid header', () => {
    it('offers sorting on Name and City only', async () => {
      await open('/owners');
      await respond(0, pageOf([franklin], 0, 10, 1));

      const headers = Array.from(root.querySelectorAll('th'));
      expect(headers.map(h => h.textContent!.replace(/[▲▼\s]+/g, ' ').trim()))
        .toEqual(['Name', 'Address', 'City', 'Telephone', 'Pets']);
      expect(headers.map(h => !!h.querySelector('button'))).toEqual([true, false, true, false, false]);
      expect(headers[0].getAttribute('aria-sort')).toBe('ascending');
      expect(headers[4].hasAttribute('aria-sort')).toBe(false);
    });
  });
});
