/* tslint:disable:no-unused-variable */

import {TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatPaginator} from '@angular/material/paginator';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerQuery} from '../owner-page';
import {Observable, of, Subject} from 'rxjs';
import {RouterTestingHarness, RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {PartsModule} from '../../parts/parts.module';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwners(query: OwnerQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let harness: RouterTestingHarness;
  let router: Router;
  let getOwnersSpy: Spy;

  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  const pageOf = (...content: Owner[]): OwnerPage =>
    ({content, totalElements: 28, totalPages: 3, number: 1, size: 10});
  const noMatch: OwnerPage = {content: [], totalElements: 0, totalPages: 0, number: 0, size: 10};
  const pastTheEnd: OwnerPage = {content: [], totalElements: 28, totalPages: 3, number: 9, size: 10};

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule, NoopAnimationsModule,
        RouterTestingModule.withRoutes(
          [{path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [{provide: OwnerService, useClass: OwnerServiceStub}]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    router = TestBed.inject(Router);
    getOwnersSpy = spyOn(TestBed.inject(OwnerService), 'getOwners')
      .and.returnValue(of(pageOf(testOwner)));
  });

  async function open(url: string) {
    harness = await RouterTestingHarness.create(url);
    await settle();
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const page = () => harness.routeNativeElement;
  const lastQuery = (): OwnerQuery => getOwnersSpy.calls.mostRecent().args[0];
  const urlParams = () => router.parseUrl(router.url).queryParams;
  const ownerNames = () => Array.from(page().querySelectorAll<HTMLElement>('td.ownerFullName'))
    .map(cell => cell.innerText);
  const buttonNamed = (name: string) => Array.from(page().querySelectorAll('button'))
    .find(button => button.innerText.trim() === name);
  const header = (name: string) => Array.from(page().querySelectorAll<HTMLElement>('th'))
    .find(th => th.innerText.trim() === name);
  const paginator = (): MatPaginator =>
    harness.routeDebugElement.query(By.directive(MatPaginator)).componentInstance;
  const searchBox = () => page().querySelector<HTMLInputElement>('#lastName');

  function type(text: string) {
    searchBox().value = text;
    searchBox().dispatchEvent(new Event('input'));
  }

  async function click(element: HTMLElement) {
    element.click();
    await settle();
  }

  describe('reading the URL', () => {
    it('leaves the defaults to the backend when the URL holds no params', async () => {
      await open('/owners');

      expect(lastQuery()).toEqual({page: undefined, size: undefined, sort: undefined, lastName: undefined});
    });

    it('requests what the URL says', async () => {
      await open('/owners?page=1&size=5&sort=city,desc&lastName=Pot');

      expect(lastQuery()).toEqual({page: 1, size: 5, sort: 'city,desc', lastName: 'Pot'});
    });

    it('requests again when the URL changes', async () => {
      await open('/owners');

      await harness.navigateByUrl('/owners?page=2');

      expect(lastQuery().page).toBe(2);
    });

    it('shows the owners that answer', async () => {
      await open('/owners');

      expect(ownerNames()).toEqual(['George Franklin']);
    });

    it('a newer query cancels an older one', async () => {
      const older = new Subject<OwnerPage>();
      const newer = new Subject<OwnerPage>();
      getOwnersSpy.and.returnValues(older, newer);
      await open('/owners');

      await harness.navigateByUrl('/owners?lastName=Franklin');
      newer.next(pageOf(testOwner));
      older.next(pageOf({...testOwner, id: 2, firstName: 'Betty', lastName: 'Davis'}));
      await settle();

      expect(older.observers).toHaveSize(0);
      expect(ownerNames()).toEqual(['George Franklin']);
    });

    it('populates the search box from the URL', async () => {
      await open('/owners?lastName=Pot');

      expect(searchBox().value).toBe('Pot');
    });

    it('survives a sort direction it does not know', async () => {
      await open('/owners?sort=city,sideways');

      expect(lastQuery().sort).toBe('city,sideways');
      expect(ownerNames()).toEqual(['George Franklin']);
    });
  });

  describe('paginator', () => {
    it('offers the sizes 5, 10 and 20', async () => {
      await open('/owners');

      expect(paginator().pageSizeOptions).toEqual([5, 10, 20]);
    });

    it('shows the position the backend answered and the total', async () => {
      await open('/owners?page=1');

      expect(paginator().pageIndex).toBe(1);
      expect(paginator().pageSize).toBe(10);
      expect(page().querySelector('mat-paginator').textContent).toContain('of 28');
    });

    it('a page change keeps every other param', async () => {
      await open('/owners?page=1&size=10&sort=city,desc&lastName=Pot');

      await click(page().querySelector('button[aria-label="Next page"]'));

      expect(urlParams()).toEqual({page: '2', size: '10', sort: 'city,desc', lastName: 'Pot'});
      expect(lastQuery().page).toBe(2);
    });

    it('a size change goes to page 0', async () => {
      await open('/owners?page=2&size=10&sort=city,desc');

      paginator()._changePageSize(20);
      await settle();

      expect(urlParams()).toEqual({page: '0', size: '20', sort: 'city,desc'});
    });
  });

  describe('sorting', () => {
    it('only Name and City are sortable', async () => {
      await open('/owners');

      const sortable = Array.from(page().querySelectorAll<HTMLElement>('th'))
        .filter(th => th.hasAttribute('mat-sort-header'))
        .map(th => th.innerText.trim());
      expect(sortable).toEqual(['Name', 'City']);
    });

    it('clicking an unsortable header does nothing', async () => {
      await open('/owners?page=1');

      await click(header('Telephone'));

      expect(urlParams()).toEqual({page: '1'});
    });

    it('a sort change goes to page 0 and keeps the rest', async () => {
      await open('/owners?page=2&size=5&lastName=Pot');

      await click(header('City'));

      expect(urlParams()).toEqual({page: '0', size: '5', sort: 'city,asc', lastName: 'Pot'});
    });

    it('starts from the default order: a first click on Name reverses it', async () => {
      await open('/owners');

      await click(header('Name'));

      expect(urlParams().sort).toBe('name,desc');
    });

    it('never clears the sort', async () => {
      await open('/owners?sort=city,desc');

      await click(header('City'));

      expect(urlParams().sort).toBe('city,asc');
    });

    it('marks the sorted column from the URL', async () => {
      await open('/owners?sort=city,desc');

      expect(header('City').getAttribute('aria-sort')).toBe('descending');
      expect(header('Name').getAttribute('aria-sort')).toBe('none');
    });
  });

  describe('searching', () => {
    it('goes to page 0 and keeps size and sort', async () => {
      await open('/owners?page=2&size=5&sort=city,desc');

      type('Potter');
      await click(buttonNamed('Find Owner'));

      expect(urlParams()).toEqual({page: '0', size: '5', sort: 'city,desc', lastName: 'Potter'});
      expect(lastQuery().lastName).toBe('Potter');
    });

    it('does nothing on a keystroke', async () => {
      await open('/owners');
      getOwnersSpy.calls.reset();

      type('Pot');
      await settle();

      expect(getOwnersSpy).not.toHaveBeenCalled();
      expect(router.url).toBe('/owners');
    });

    it('a blank search drops lastName from the URL', async () => {
      await open('/owners?lastName=Pot');

      type('');
      await click(buttonNamed('Find Owner'));

      expect(urlParams()).toEqual({page: '0'});
    });
  });

  describe('a page past the end', () => {
    it('moves to the last page, keeping the rest, without a Back entry', async () => {
      const navigate = spyOn(router, 'navigate').and.callThrough();
      getOwnersSpy.and.callFake((query: OwnerQuery) => of(query.page === 9 ? pastTheEnd : pageOf(testOwner)));

      await open('/owners?page=9&size=10&sort=city,asc');

      expect(urlParams()).toEqual({page: '2', size: '10', sort: 'city,asc'});
      expect(navigate.calls.mostRecent().args[1].replaceUrl).toBe(true);
      expect(ownerNames()).toEqual(['George Franklin']);
    });

    it('does not claim that nothing matches on the way there', async () => {
      const lastPage = new Subject<OwnerPage>();
      getOwnersSpy.and.callFake((query: OwnerQuery) => query.page === 9 ? of(pastTheEnd) : lastPage);

      await open('/owners?page=9');

      expect(page().textContent).not.toContain('No owners');
    });

    it('stays where the user went when the answer lands after leaving the grid', async () => {
      const answer = new Subject<OwnerPage>();
      getOwnersSpy.and.returnValue(answer);
      await open('/owners?page=9');

      await harness.navigateByUrl('/owners/add');
      answer.next(pastTheEnd);
      await settle();

      expect(router.url).toBe('/owners/add');
    });
  });

  describe('no match', () => {
    beforeEach(() => getOwnersSpy.and.returnValue(of(noMatch)));

    it('says which search found nothing', async () => {
      await open('/owners?lastName=Zzzz');

      expect(page().textContent).toContain('No owners with LastName starting with "Zzzz"');
    });

    it('keeps quoting the search, not what is typed since', async () => {
      await open('/owners?lastName=Zzzz');

      type('Other');
      await settle();

      expect(page().textContent).toContain('No owners with LastName starting with "Zzzz"');
    });

    it('keeps Add Owner', async () => {
      await open('/owners?lastName=Zzzz');

      expect(buttonNamed('Add Owner')).toBeTruthy();
    });

    it('drops the table and the paginator', async () => {
      await open('/owners?lastName=Zzzz');

      expect(page().querySelector('#ownersTable')).toBeNull();
      expect(page().querySelector('mat-paginator')).toBeNull();
    });
  });

  it('says nothing about matches before the first answer', async () => {
    getOwnersSpy.and.returnValue(new Subject<OwnerPage>());

    await open('/owners?lastName=Pot');

    expect(page().textContent).not.toContain('No owners');
  });

  it('Add Owner opens the form', async () => {
    await open('/owners');

    await click(buttonNamed('Add Owner'));

    expect(router.url).toBe('/owners/add');
  });
});
