import {fakeAsync, flush, TestBed, tick} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Router} from '@angular/router';
import {RouterTestingHarness, RouterTestingModule} from '@angular/router/testing';
import {Observable, of, throwError} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {OwnerListItem, OwnerPage, OwnerQuery} from '../owner-page';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';

// The owner-list spec's grid scenarios (openspec/changes/paginate-owners-grid/specs/owner-list/spec.md),
// driven through the real router: the URL is the grid's state.
describe('OwnerListComponent', () => {
  const kevin: OwnerListItem = {
    id: 1, firstName: 'Kevin', lastName: 'McCallister', address: '671 Lincoln Boulevard',
    city: 'Winnetka', telephone: '8474461990', pets: [{id: 1, name: 'Axel'}]
  };
  const pageOf = (content: OwnerListItem[], totalElements: number, number = 0): OwnerPage =>
    ({content, totalElements, totalPages: Math.ceil(totalElements / 10), number, size: 10});

  let listOwners: jasmine.Spy<(query: OwnerQuery) => Observable<OwnerPage>>;
  let harness: RouterTestingHarness;
  let router: Router;

  beforeEach(async () => {
    listOwners = jasmine.createSpy('listOwners').and.returnValue(of(pageOf([kevin], 27)));
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule.withRoutes([
        {path: 'owners', component: OwnerListComponent},
        {path: 'owners/:id', component: DummyComponent},
      ])],
      providers: [{provide: OwnerService, useValue: {listOwners}}],
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  const open = (url: string) => harness.navigateByUrl(url, OwnerListComponent);
  const queryParams = () => router.parseUrl(router.url).queryParams;
  const text = (css: string) => harness.routeNativeElement!.querySelector(css)?.textContent?.trim();

  it('asks for the page, size, sort and search the URL holds', async () => {
    await open('/owners?lastName=Pot&page=3&size=5&sort=city,desc');

    expect(listOwners).toHaveBeenCalledWith({lastName: 'Pot', page: 2, size: 5, sort: 'city', direction: 'desc'});
  });

  it('opens on the defaults and keeps them out of the URL', async () => {
    await open('/owners');

    expect(listOwners).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name', direction: 'asc'});
    expect(router.url).toBe('/owners');
  });

  it('a new search goes back to page 1', async () => {
    const grid = await open('/owners?page=3');

    grid.searchByLastName('Pot');
    await harness.fixture.whenStable();

    expect(queryParams()).toEqual({lastName: 'Pot'});
  });

  it('searches once typing pauses for 300 ms, on page 1', fakeAsync(() => {
    let grid: OwnerListComponent;
    harness.navigateByUrl('/owners?page=3', OwnerListComponent).then(g => grid = g);
    flush();

    grid!.onLastNameTyped('P');
    tick(100);
    grid!.onLastNameTyped('Pot');
    tick(299);
    expect(queryParams()).toEqual({page: '3'});

    tick(1);
    flush();
    expect(queryParams()).toEqual({lastName: 'Pot'});
  }));

  it('has no Find Owner button, and Add Owner sits below the grid', async () => {
    await open('/owners');

    const buttons = Array.from(harness.routeNativeElement!.querySelectorAll('button')).map(b => b.textContent!.trim());
    expect(buttons).not.toContain('Find Owner');
    expect(harness.routeNativeElement!.querySelector('.owners-search-row #addOwner')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('#ownersTable ~ .owners-actions #addOwner')).toBeTruthy();
    expect((harness.routeNativeElement!.querySelector('#lastName') as HTMLInputElement).placeholder).toBe('Last name');
  });

  it('a new page size goes back to page 1', async () => {
    const grid = await open('/owners?page=3');

    grid.onPage({pageIndex: 2, pageSize: 20, previousPageIndex: 2, length: 27});
    await harness.fixture.whenStable();

    expect(queryParams()).toEqual({size: '20'});
  });

  it('a new sort goes back to page 1', async () => {
    const grid = await open('/owners?page=2');

    grid.onSort({active: 'city', direction: 'desc'});
    await harness.fixture.whenStable();

    expect(queryParams()).toEqual({sort: 'city,desc'});
  });

  it('moving to another page keeps the sort and search', async () => {
    const grid = await open('/owners?lastName=Pot&sort=city,desc');

    grid.onPage({pageIndex: 1, pageSize: 10, previousPageIndex: 0, length: 27});
    await harness.fixture.whenStable();

    expect(queryParams()).toEqual({lastName: 'Pot', page: '2', sort: 'city,desc'});
  });

  it('a page past the end moves to the last page', async () => {
    listOwners.and.returnValue(of(pageOf([], 27, 5)));
    await open('/owners?page=6');
    await harness.fixture.whenStable();

    expect(queryParams()).toEqual({page: '3'});
  });

  it('shows the name surname first', async () => {
    await open('/owners');

    expect(text('td.ownerFullName')).toBe('McCallister, Kevin');
  });

  it('only Name and City can be sorted', async () => {
    await open('/owners');

    const sortable = harness.fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
      .map(th => th.nativeElement.textContent.trim());
    expect(sortable).toEqual(['Name', 'City']);
  });

  it('says no owners were found only when nothing matched', async () => {
    listOwners.and.returnValue(of(pageOf([], 0)));
    await open('/owners?lastName=Zzzz');

    expect(text('#noOwners')).toContain('No owners');
    expect(text('#ownersError')).toBeUndefined();
  });

  it('a failed request shows an error, not "no owners found"', async () => {
    listOwners.and.returnValue(throwError(() => new Error('boom')));
    await open('/owners');

    expect(text('#ownersError')).toContain('could not be loaded');
    expect(text('#noOwners')).toBeUndefined();
  });
});
