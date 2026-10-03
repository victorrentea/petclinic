import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatPaginator } from '@angular/material/paginator';
import { MatSortHeader } from '@angular/material/sort';
import { Observable, Subject } from 'rxjs';

import { OwnerListComponent } from './owner-list.component';
import { OwnersModule } from '../owners.module';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { OwnerPage, OwnerPageQuery } from '../owner-page';
import { DummyComponent } from '../../testing/dummy.component';

/** One call to getOwners: what was asked, and the handle to answer it whenever the test chooses. */
interface PageRequest {
  query: OwnerPageQuery;
  response: Subject<OwnerPage>;
}

class OwnerServiceStub {
  getOwners(query: OwnerPageQuery = {}): Observable<OwnerPage> {
    return new Subject<OwnerPage>();
  }
}

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let requests: PageRequest[];

  const owner = (id: number, lastName = 'Franklin'): Owner => ({
    id,
    firstName: 'George',
    lastName,
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  });
  const owners = (count: number): Owner[] => Array.from({ length: count }, (_, i) => owner(i + 1));

  const lastRequest = () => requests[requests.length - 1];
  const answer = (request: PageRequest, content: Owner[], totalElements: number) => {
    request.response.next({ content, totalElements });
    request.response.complete();
    fixture.detectChanges();
  };
  const query = (css: string) => fixture.debugElement.query(By.css(css));
  const text = (css: string) => (query(css)?.nativeElement as HTMLElement | undefined)?.textContent?.trim();

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      imports: [OwnersModule, NoopAnimationsModule,
        RouterTestingModule.withRoutes([
          { path: 'owners/add', component: DummyComponent },
          { path: 'owners/:id', component: DummyComponent }])],
      providers: [{ provide: OwnerService, useClass: OwnerServiceStub }]
    }).compileComponents();
  }));

  beforeEach(() => {
    requests = [];
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    spyOn(TestBed.inject(OwnerService), 'getOwners').and.callFake((q: OwnerPageQuery = {}) => {
      const response = new Subject<OwnerPage>();
      requests.push({ query: q, response });
      return response;
    });
    fixture.detectChanges();
  });

  describe('requests', () => {
    it('opens on page 0 of 10 owners by Name ascending', () => {
      expect(requests).toHaveSize(1);
      expect(lastRequest().query).toEqual({ lastName: '', page: 0, size: 10, sort: 'name,asc' });
    });

    it('a submitted search asks once for page 0 with that prefix, keeping the sort', () => {
      answer(lastRequest(), owners(10), 50);
      component.onSort({ active: 'city', direction: 'desc' });
      component.onPage({ pageIndex: 3, pageSize: 10, length: 50 });
      component.lastName = 'Fr';

      component.search();

      expect(requests).toHaveSize(4);
      expect(lastRequest().query).toEqual({ lastName: 'Fr', page: 0, size: 10, sort: 'city,desc' });
    });

    it('moving to another page asks once, with the submitted prefix rather than the typed one', () => {
      component.lastName = 'Fr';
      component.search();
      component.lastName = 'Typed but not submitted';

      component.onPage({ pageIndex: 1, pageSize: 10, length: 50 });

      expect(requests).toHaveSize(3);
      expect(lastRequest().query).toEqual({ lastName: 'Fr', page: 1, size: 10, sort: 'name,asc' });
    });

    it('a new page size goes back to page 0', () => {
      component.onPage({ pageIndex: 3, pageSize: 10, length: 50 });

      component.onPage({ pageIndex: 1, pageSize: 20, length: 50, previousPageIndex: 3 });

      expect(requests).toHaveSize(3);
      expect(lastRequest().query).toEqual({ lastName: '', page: 0, size: 20, sort: 'name,asc' });
    });

    it('a new sort goes back to page 0', () => {
      component.onPage({ pageIndex: 3, pageSize: 5, length: 50 });

      component.onSort({ active: 'name', direction: 'desc' });

      expect(requests).toHaveSize(3);
      expect(lastRequest().query).toEqual({ lastName: '', page: 0, size: 5, sort: 'name,desc' });
    });

    it('the Find Owner button submits exactly one search', async () => {
      await fixture.whenStable(); // ngModel joins its form asynchronously
      const input: HTMLInputElement = query('#lastName').nativeElement;
      input.value = 'Fr';
      input.dispatchEvent(new Event('input'));

      query('#search-owner-form button[type=submit]').nativeElement.click();

      expect(requests).toHaveSize(2);
      expect(lastRequest().query.lastName).toBe('Fr');
    });
  });

  describe('only the latest request answers', () => {
    it('a late initial load does not overwrite a search', () => {
      const initialLoad = lastRequest();
      component.lastName = 'Davis';
      component.search();

      answer(initialLoad, owners(10), 26);

      expect(component.owners).toEqual([]);
      expect(component.loading).toBeTrue();
      answer(lastRequest(), [owner(2, 'Davis')], 1);
      expect(component.owners).toEqual([owner(2, 'Davis')]);
      expect(component.totalElements).toBe(1);
      expect(component.loading).toBeFalse();
    });

    it('a late failure of an older request shows no error', () => {
      const older = lastRequest();
      component.onPage({ pageIndex: 1, pageSize: 10, length: 50 });

      older.response.error('server returned code 500');
      fixture.detectChanges();

      expect(component.errorMessage).toBeNull();
      expect(query('#ownersError')).toBeNull();
    });

    it('leaving the screen cancels the outstanding request', () => {
      const pending = lastRequest();

      fixture.destroy();

      expect(pending.response.observers).toHaveSize(0);
    });
  });

  describe('rendering', () => {
    it('shows the page rows, the range and total, and sizes 5, 10, 20', () => {
      answer(lastRequest(), owners(10), 26);

      expect(fixture.debugElement.queryAll(By.css('#ownersTable td.ownerFullName'))).toHaveSize(10);
      expect(text('.mat-mdc-paginator-range-label')).toBe('1 – 10 of 26');
      const paginator: MatPaginator = query('mat-paginator').componentInstance;
      expect(paginator.pageSizeOptions).toEqual([5, 10, 20]);
      expect(paginator.pageSize).toBe(10);
    });

    it('the next and previous buttons each ask for one adjacent page', () => {
      answer(lastRequest(), owners(10), 26);

      query('button.mat-mdc-paginator-navigation-next').nativeElement.click();
      expect(requests).toHaveSize(2);
      expect(lastRequest().query.page).toBe(1);
      answer(lastRequest(), owners(10), 26);

      query('button.mat-mdc-paginator-navigation-previous').nativeElement.click();
      expect(requests).toHaveSize(3);
      expect(lastRequest().query.page).toBe(0);
    });

    it('only Name and City can be sorted', () => {
      answer(lastRequest(), owners(1), 1);

      const sortable = fixture.debugElement.queryAll(By.directive(MatSortHeader))
        .map(header => (header.nativeElement as HTMLElement).textContent?.trim());
      const all = fixture.debugElement.queryAll(By.css('#ownersTable th'))
        .map(header => (header.nativeElement as HTMLElement).textContent?.trim());
      expect(sortable).toEqual(['Name', 'City']);
      expect(all).toEqual(['Name', 'Address', 'City', 'Telephone', 'Pets']);
    });

    it('a sortable header toggles from the keyboard, never back to unsorted', () => {
      answer(lastRequest(), owners(1), 1);
      const nameHeader = fixture.debugElement.queryAll(By.directive(MatSortHeader))[0].nativeElement;

      pressEnter(nameHeader);
      expect(lastRequest().query.sort).toBe('name,desc');
      pressEnter(nameHeader);
      expect(lastRequest().query.sort).toBe('name,asc');
      expect(requests).toHaveSize(3);
    });

    it('no match shows the submitted prefix and hides the paginator', () => {
      component.lastName = 'Zz';
      component.search();
      component.lastName = 'edited afterwards';
      answer(lastRequest(), [], 0);

      expect(text('#noOwners')).toBe('No owners with last name starting with "Zz"');
      expect(query('mat-paginator')).toBeNull();
      expect(query('#ownersError')).toBeNull();
    });

    it('an empty page of a non-empty result keeps the way back', () => {
      answer(lastRequest(), [], 26);

      expect(query('#noOwners')).toBeNull();
      expect(query('mat-paginator')).not.toBeNull();
    });

    it('a failure is reported as such, not as no matches', () => {
      lastRequest().response.error('server returned code 500');
      fixture.detectChanges();

      expect(text('#ownersError')).toContain('server returned code 500');
      expect(query('#noOwners')).toBeNull();
      expect(component.loading).toBeFalse();
    });

    it('a failed page keeps the paginator, so the user can retry from where they were', () => {
      answer(lastRequest(), owners(10), 26);
      query('button.mat-mdc-paginator-navigation-next').nativeElement.click();
      lastRequest().response.error('server returned code 500');
      fixture.detectChanges();

      query('button.mat-mdc-paginator-navigation-previous').nativeElement.click();

      expect(text('#ownersError')).toContain('server returned code 500');
      expect(requests).toHaveSize(3);
      expect(lastRequest().query.page).toBe(0);
    });

    it('owner names link to their detail page', () => {
      answer(lastRequest(), [owner(7)], 1);

      expect(query('td.ownerFullName a').nativeElement.getAttribute('href')).toBe('/owners/7');
    });

    it('Add Owner is offered while loading, on no match and on failure', () => {
      const addOwner = () => fixture.debugElement.queryAll(By.css('button'))
        .find(b => (b.nativeElement as HTMLElement).textContent?.trim() === 'Add Owner');
      expect(addOwner()).toBeTruthy();

      answer(lastRequest(), [], 0);
      expect(addOwner()).toBeTruthy();

      component.search();
      lastRequest().response.error('down');
      fixture.detectChanges();
      expect(addOwner()).toBeTruthy();
    });
  });

  function pressEnter(element: HTMLElement) {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(event, 'keyCode', { get: () => 13 });
    element.dispatchEvent(event);
    fixture.detectChanges();
  }
});
