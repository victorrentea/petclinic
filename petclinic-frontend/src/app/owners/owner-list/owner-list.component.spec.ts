import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerListQuery, OwnerPage} from '../owner-page';
import {Observable, Subject} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {PartsModule} from '../../parts/parts.module';
import {ActivatedRouteStub} from '../../testing/router-stubs';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  listOwners(query?: OwnerListQuery): Observable<OwnerPage> {
    return new Subject<OwnerPage>();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let listOwnersSpy: Spy;
  /** One pending answer per request, in the order the requests were sent. */
  let responses: Subject<OwnerPage>[];

  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };

  const ownerNo = (id: number): Owner => ({...testOwner, id, lastName: 'Owner' + id});
  const pageOf = (count: number, totalElements: number): OwnerPage =>
    ({content: Array.from({length: count}, (_, i) => ownerNo(i + 1)), totalElements});

  const requests = (): OwnerListQuery[] => listOwnersSpy.calls.allArgs().map(args => args[0]);
  const lastRequest = (): OwnerListQuery => listOwnersSpy.calls.mostRecent().args[0];
  const answer = (index: number, page: OwnerPage) => {
    responses[index].next(page);
    responses[index].complete();
  };
  const text = (): string => fixture.nativeElement.textContent;
  const query = (css: string) => fixture.debugElement.query(By.css(css));

  /** Opens the screen and answers its initial load with a page of 10 out of 26 owners. */
  const openOnFirstPage = () => {
    fixture.detectChanges();
    answer(0, pageOf(10, 26));
    fixture.detectChanges();
    listOwnersSpy.calls.reset();
  };

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
      providers: [
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    responses = [];
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    const ownerService = fixture.debugElement.injector.get(OwnerService);
    listOwnersSpy = spyOn(ownerService, 'listOwners').and.callFake(() => {
      const response = new Subject<OwnerPage>();
      responses.push(response);
      return response;
    });
  });

  describe('initial state', () => {
    it('asks once for the API defaults: first page of 10, Name ascending, no filter', () => {
      fixture.detectChanges();

      expect(requests()).toEqual([{lastName: '', page: 0, size: 10, sort: 'name,asc'}]);
      expect(component.loading).toBeTrue();
    });

    it('shows the full name of each owner once the page arrives', () => {
      fixture.detectChanges();
      answer(0, {content: [testOwner], totalElements: 1});
      fixture.detectChanges();

      expect(query('.ownerFullName').nativeElement.innerText).toBe('George Franklin');
      expect(component.loading).toBeFalse();
    });
  });

  describe('one request per action', () => {
    it('next page keeps the filter, size and sort', () => {
      openOnFirstPage();

      component.onPage({pageIndex: 1, previousPageIndex: 0, pageSize: 10, length: 26});

      expect(requests()).toEqual([{lastName: '', page: 1, size: 10, sort: 'name,asc'}]);
    });

    it('a search from a later page goes back to page 0 and keeps the sort', () => {
      openOnFirstPage();
      component.onSort({active: 'city', direction: 'desc'});
      component.onPage({pageIndex: 2, previousPageIndex: 0, pageSize: 10, length: 26});
      listOwnersSpy.calls.reset();

      component.draftLastName = 'Pot';
      component.search();

      expect(requests()).toEqual([{lastName: 'Pot', page: 0, size: 10, sort: 'city,desc'}]);
    });

    it('a page size change goes back to page 0', () => {
      openOnFirstPage();
      component.onPage({pageIndex: 2, previousPageIndex: 0, pageSize: 10, length: 26});
      listOwnersSpy.calls.reset();

      component.onPage({pageIndex: 1, previousPageIndex: 2, pageSize: 20, length: 26});

      expect(requests()).toEqual([{lastName: '', page: 0, size: 20, sort: 'name,asc'}]);
    });

    it('a sort change goes back to page 0', () => {
      openOnFirstPage();
      component.onPage({pageIndex: 2, previousPageIndex: 0, pageSize: 10, length: 26});
      listOwnersSpy.calls.reset();

      component.onSort({active: 'name', direction: 'desc'});

      expect(requests()).toEqual([{lastName: '', page: 0, size: 10, sort: 'name,desc'}]);
    });

    it('paging uses the submitted prefix, not text typed but never searched', () => {
      openOnFirstPage();
      component.draftLastName = 'Pot';
      component.search();
      component.draftLastName = 'Typed but not searched';

      component.onPage({pageIndex: 1, previousPageIndex: 0, pageSize: 10, length: 26});

      expect(lastRequest().lastName).toBe('Pot');
    });

    it('submitting the search form sends exactly one request', () => {
      openOnFirstPage();
      component.draftLastName = 'Pot';

      query('#search-owner-form button[type=submit]').nativeElement.click();

      expect(requests()).toEqual([{lastName: 'Pot', page: 0, size: 10, sort: 'name,asc'}]);
    });
  });

  describe('only the latest request answers', () => {
    it('a search is not overwritten by the initial load answering late', () => {
      fixture.detectChanges();
      component.draftLastName = 'Franklin';
      component.search();

      answer(1, {content: [testOwner], totalElements: 1});
      answer(0, pageOf(10, 26));

      expect(component.owners).toEqual([testOwner]);
      expect(component.totalElements).toBe(1);
    });

    it('a late page cannot overwrite the latest one', () => {
      openOnFirstPage();
      component.onPage({pageIndex: 1, previousPageIndex: 0, pageSize: 10, length: 26});
      component.onPage({pageIndex: 2, previousPageIndex: 1, pageSize: 10, length: 26});

      answer(2, pageOf(6, 26));
      answer(1, pageOf(10, 99));

      expect(component.owners.length).toBe(6);
      expect(component.totalElements).toBe(26);
    });

    it('a late failure or completion of an older request leaves the latest one loading', () => {
      fixture.detectChanges();
      component.draftLastName = 'Pot';
      component.search();

      responses[0].error('boom');
      responses[0].complete();

      expect(component.loading).toBeTrue();
      expect(component.errorMessage).toBeNull();
    });

    it('a new request clears the error of the previous one', () => {
      fixture.detectChanges();
      responses[0].error('boom');
      expect(component.errorMessage).toBe('boom');

      component.search();

      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeTrue();
    });

    it('leaving the screen cancels the request in flight', () => {
      fixture.detectChanges();

      fixture.destroy();

      expect(responses[0].observers.length).toBe(0);
    });
  });

  describe('empty results and failures', () => {
    it('no match: says so with the submitted prefix and hides the paginator', () => {
      openOnFirstPage();
      component.draftLastName = 'Zz';
      component.search();
      component.draftLastName = 'edited after searching';
      answer(1, pageOf(0, 0));
      fixture.detectChanges();

      expect(text()).toContain('No owners with LastName starting with "Zz"');
      expect(query('mat-paginator')).toBeNull();
    });

    it('an empty page out of a nonzero total does not claim there are no matches', () => {
      openOnFirstPage();
      component.onPage({pageIndex: 5, previousPageIndex: 0, pageSize: 10, length: 26});
      answer(1, pageOf(0, 26));
      fixture.detectChanges();

      expect(text()).not.toContain('No owners with LastName');
      expect(query('mat-paginator')).not.toBeNull();
    });

    it('a failure is shown as an error, never as no matches', () => {
      fixture.detectChanges();
      responses[0].error('server returned code 500');
      fixture.detectChanges();

      expect(query('.alert-danger').nativeElement.textContent).toContain('server returned code 500');
      expect(text()).not.toContain('No owners with LastName');
    });

    it('Add Owner stays available while loading, when empty and after a failure', () => {
      fixture.detectChanges();
      expect(query('#addOwner')).not.toBeNull();

      answer(0, pageOf(0, 0));
      fixture.detectChanges();
      expect(query('#addOwner')).not.toBeNull();

      component.search();
      responses[1].error('boom');
      fixture.detectChanges();
      expect(query('#addOwner')).not.toBeNull();
    });
  });

  describe('grid controls', () => {
    const headers = (): HTMLElement[] =>
      fixture.debugElement.queryAll(By.css('#ownersTable th')).map(th => th.nativeElement);
    const header = (label: string): HTMLElement => headers().find(th => th.textContent.trim() === label);
    const click = (css: string) => {
      query(css).nativeElement.click();
      fixture.detectChanges();
    };

    beforeEach(() => openOnFirstPage());

    it('offers page sizes 5, 10 and 20, starting at 10', () => {
      const paginator = query('mat-paginator').componentInstance;

      expect(paginator.pageSizeOptions).toEqual([5, 10, 20]);
      expect(paginator.pageSize).toBe(10);
    });

    it('shows the range and the total', () => {
      expect(query('.mat-mdc-paginator-range-label').nativeElement.textContent.trim()).toBe('1 – 10 of 26');
    });

    it('next and previous each send one request for the neighbouring page', () => {
      click('.mat-mdc-paginator-navigation-next');
      expect(requests()).toEqual([{lastName: '', page: 1, size: 10, sort: 'name,asc'}]);
      answer(1, pageOf(10, 26));
      fixture.detectChanges();
      expect(query('.mat-mdc-paginator-range-label').nativeElement.textContent.trim()).toBe('11 – 20 of 26');

      listOwnersSpy.calls.reset();
      click('.mat-mdc-paginator-navigation-previous');
      expect(requests()).toEqual([{lastName: '', page: 0, size: 10, sort: 'name,asc'}]);
    });

    it('only Name and City can be sorted', () => {
      const sortable = headers()
        .filter(th => th.classList.contains('mat-sort-header'))
        .map(th => th.textContent.trim());

      expect(sortable).toEqual(['Name', 'City']);
    });

    it('clicking the active Name header flips it, and never clears the sort', () => {
      header('Name').click();
      expect(lastRequest().sort).toBe('name,desc');

      header('Name').click();
      expect(lastRequest().sort).toBe('name,asc');
    });

    it('sorts from the keyboard', () => {
      header('City').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', keyCode: 13} as KeyboardEventInit));

      expect(requests()).toEqual([{lastName: '', page: 0, size: 10, sort: 'city,asc'}]);
    });

    it('owner names link to their detail page', () => {
      const link = query('.ownerFullName a').nativeElement as HTMLAnchorElement;

      expect(link.getAttribute('href')).toBe('/owners/1');
    });
  });
});
