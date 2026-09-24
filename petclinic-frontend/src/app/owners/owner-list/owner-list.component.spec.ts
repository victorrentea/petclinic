import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {RouterTestingHarness} from '@angular/router/testing';
import {Subject} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {OwnerPage, OwnerRow} from '../owner';
import {OwnerQuery} from '../owner-query';
import {DesignSystemModule} from '../../design-system/design-system.module';
import {DummyComponent} from '../../testing/dummy.component';

describe('OwnerListComponent', () => {
  let harness: RouterTestingHarness;
  let component: OwnerListComponent;
  let router: Router;
  let listOwners: jasmine.Spy;
  let pending: Subject<OwnerPage>[];

  const harry: OwnerRow = {
    id: 1, firstName: 'Harry', lastName: 'Potter', address: '4 Privet Drive',
    city: 'Little Whinging', telephone: '0119084455', petNames: ['Hedwig', 'Norbert']
  };

  const pageOf = (content: OwnerRow[], overrides: Partial<OwnerPage> = {}): OwnerPage => ({
    content, totalElements: content.length, totalPages: content.length ? 1 : 0, number: 0, size: 10, ...overrides
  });

  beforeEach(async () => {
    pending = [];
    listOwners = jasmine.createSpy('listOwners').and.callFake(() => {
      const response = new Subject<OwnerPage>();
      pending.push(response);
      return response;
    });
    TestBed.configureTestingModule({
      declarations: [OwnerListComponent, DummyComponent],
      imports: [FormsModule, DesignSystemModule, RouterTestingModule.withRoutes([
        {path: 'owners', component: OwnerListComponent},
        {path: 'owners/add', component: DummyComponent},
        {path: 'owners/:id', component: DummyComponent}
      ])],
      providers: [{provide: OwnerService, useValue: {listOwners}}]
    });
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  async function open(url: string) {
    component = await harness.navigateByUrl(url, OwnerListComponent);
  }

  function answer(page: OwnerPage, requestIndex = pending.length - 1) {
    pending[requestIndex].next(page);
    pending[requestIndex].complete();
    harness.detectChanges();
  }

  function failLoad(requestIndex = pending.length - 1) {
    pending[requestIndex].error({status: 500});
    harness.detectChanges();
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const lastRequest = (): OwnerQuery => listOwners.calls.mostRecent().args[0];
  const query = (selector: string) => harness.routeDebugElement!.query(By.css(selector));
  const element = (selector: string): HTMLElement => query(selector)?.nativeElement;
  const text = (selector: string) => element(selector)?.textContent?.trim();

  describe('reads the address', () => {
    it('requests the defaults for a bare address', async () => {
      await open('/owners');
      expect(lastRequest()).toEqual({lastName: '', page: 0, size: 10, sort: 'name', direction: 'asc'});
    });

    it('requests exactly what a shared link names', async () => {
      await open('/owners?lastName=Pot&page=2&size=5&sort=city&direction=desc');
      expect(lastRequest()).toEqual({lastName: 'Pot', page: 2, size: 5, sort: 'city', direction: 'desc'});
      expect((element('#lastName') as HTMLInputElement).value).toBe('Pot');
    });

    it('replaces invalid values by their defaults instead of sending them', async () => {
      await open('/owners?page=-1&size=7&sort=telephone&direction=up');
      expect(lastRequest()).toEqual({lastName: '', page: 0, size: 10, sort: 'name', direction: 'asc'});
    });

    it('shows the latest answer only, when an older one arrives last', async () => {
      await open('/owners');
      await router.navigateByUrl('/owners?lastName=Pot');
      await settle();

      answer(pageOf([harry]), 1);
      answer(pageOf([{...harry, id: 2, lastName: 'Davis'}]), 0);

      expect(pending[0].observers.length).toBe(0);
      expect(component.owners).toEqual([harry]);
    });
  });

  describe('user actions change only the address', () => {
    beforeEach(async () => {
      await open('/owners?page=2&size=5&sort=city');
      answer(pageOf([harry], {totalElements: 30, totalPages: 6, number: 2, size: 5}));
    });

    it('a search resets to the first page, keeping size and sort', async () => {
      component.lastName = 'Pot';
      element('#search-owner-form button[type="submit"]').click();
      await settle();
      expect(router.url).toBe('/owners?lastName=Pot&size=5&sort=city');
    });

    it('next and previous change only the page', async () => {
      element('#nextPage').click();
      await settle();
      expect(router.url).toBe('/owners?page=3&size=5&sort=city');
      answer(pageOf([harry], {totalElements: 30, totalPages: 6, number: 3, size: 5}));

      element('#prevPage').click();
      await settle();
      expect(router.url).toBe('/owners?page=2&size=5&sort=city');
    });

    it('a new page size resets to the first page', async () => {
      component.changePageSize(20);
      await settle();
      expect(router.url).toBe('/owners?size=20&sort=city');
    });

    it('sorting by another column goes ascending from the first page', async () => {
      element('th button.sort-name').click();
      await settle();
      expect(router.url).toBe('/owners?size=5');
    });

    it('clicking the active sort column toggles its direction, never unsorting', async () => {
      element('th button.sort-city').click();
      await settle();
      expect(router.url).toBe('/owners?size=5&sort=city&direction=desc');
      answer(pageOf([harry]));

      element('th button.sort-city').click();
      await settle();
      expect(router.url).toBe('/owners?size=5&sort=city');
    });

    it('marks the active sort column for assistive technology', () => {
      expect(query('th.col-city').attributes['aria-sort']).toBe('ascending');
      expect(query('th.col-name').attributes['aria-sort']).toBe('none');
    });
  });

  describe('a page past the end', () => {
    it('moves once to the last page, replacing the address', async () => {
      await open('/owners?page=50');
      const navigate = spyOn(router, 'navigate').and.callThrough();

      answer(pageOf([], {totalElements: 25, totalPages: 3, number: 50}));
      await settle();

      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.calls.mostRecent().args[1]?.replaceUrl).toBeTrue();
      expect(router.url).toBe('/owners?page=2');
      expect(lastRequest().page).toBe(2);
    });

    it('moves to the first page when nothing matches', async () => {
      await open('/owners?lastName=Zz&page=4');
      answer(pageOf([], {number: 4}));
      await settle();
      expect(router.url).toBe('/owners?lastName=Zz');
    });

    it('does not keep correcting when the corrected page is out of range again', async () => {
      await open('/owners?page=50');
      answer(pageOf([], {totalElements: 25, totalPages: 3, number: 50}));
      await settle();
      const navigate = spyOn(router, 'navigate').and.callThrough();

      answer(pageOf([], {totalElements: 0, totalPages: 0, number: 2}));
      await settle();

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('renders', () => {
    beforeEach(async () => {
      await open('/owners');
    });

    it('owners as "LastName, FirstName" linking to their page, with pet names', () => {
      answer(pageOf([harry]));
      expect(text('#ownersTable td.ownerFullName a')).toBe('Potter, Harry');
      expect(element('#ownersTable td.ownerFullName a').getAttribute('href')).toBe('/owners/1');
      expect(text('#ownersTable td.ownerPets')).toBe('Hedwig, Norbert');
    });

    it('the count and the page position', () => {
      answer(pageOf([harry], {totalElements: 21, totalPages: 3, number: 0}));
      expect(text('#ownersCount')).toBe('21 owners');
      expect(text('#pageInfo')).toBe('Page 1 of 3');
    });

    it('placeholder rows instead of owners while loading, so the table keeps its height', () => {
      harness.detectChanges();
      expect(query('#ownersTable td.ownerFullName')).toBeNull();
      expect(harness.routeDebugElement!.queryAll(By.css('.owner-row-placeholder')).length).toBe(10);
      expect(element('#ownersTable').getAttribute('aria-busy')).toBe('true');
    });

    it('previous disabled on the first page, next disabled on the last', () => {
      answer(pageOf([harry], {totalElements: 1, totalPages: 1, number: 0}));
      expect((element('#prevPage') as HTMLButtonElement).disabled).toBeTrue();
      expect((element('#nextPage') as HTMLButtonElement).disabled).toBeTrue();
    });

    it('next enabled when more pages follow', () => {
      answer(pageOf([harry], {totalElements: 21, totalPages: 3, number: 0}));
      expect((element('#nextPage') as HTMLButtonElement).disabled).toBeFalse();
    });

    it('the empty message, and no error, when nothing matches', () => {
      answer(pageOf([]));
      expect(text('#noOwners')).toBe('No owners with LastName starting with ""');
      expect(query('#ownersError')).toBeNull();
    });

    it('an error banner, and not the empty message, when loading fails', () => {
      failLoad();
      expect(query('#ownersError')).not.toBeNull();
      expect(query('#noOwners')).toBeNull();
      expect(query('#ownersTable td.ownerFullName')).toBeNull();
    });

    it('a working grid again after a failed load', async () => {
      failLoad();
      await router.navigateByUrl('/owners?lastName=Pot');
      await settle();
      answer(pageOf([harry]));
      expect(query('#ownersError')).toBeNull();
      expect(text('#ownersTable td.ownerFullName')).toBe('Potter, Harry');
    });
  });
});
