import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatPaginator } from '@angular/material/paginator';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { OwnerPage, OwnerPageQuery } from '../owner-page';
import { Observable, of, Subject, throwError } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { PartsModule } from '../../parts/parts.module';
import { ActivatedRouteStub } from '../../testing/router-stubs';
import { OwnerDetailComponent } from '../owner-detail/owner-detail.component';
import { OwnersModule } from '../owners.module';
import { DummyComponent } from '../../testing/dummy.component';
import { OwnerAddComponent } from '../owner-add/owner-add.component';
import { OwnerEditComponent } from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  getOwners(query?: OwnerPageQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let getOwnersSpy: Spy;

  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: [],
  };
  const davis: Owner = { ...testOwner, id: 2, firstName: 'Betty', lastName: 'Davis' };
  const pageOf = (owners: Owner[], totalElements = owners.length): OwnerPage => ({ content: owners, totalElements });

  const lastQuery = (): OwnerPageQuery => getOwnersSpy.calls.mostRecent().args[0];
  const text = (selector: string): string | undefined =>
    fixture.debugElement.query(By.css(selector))?.nativeElement.textContent.trim();
  const exists = (selector: string): boolean => !!fixture.debugElement.query(By.css(selector));

  function startWith(answer: Observable<OwnerPage>) {
    getOwnersSpy.and.returnValue(answer);
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
  }

  // Typed through the model: ngModel inside a form only wires the input a tick after creation
  function submitSearch(prefix: string) {
    component.lastNameDraft = prefix;
    fixture.debugElement.query(By.css('#search-owner-form button[type=submit]')).nativeElement.click();
    fixture.detectChanges();
  }

  function goToPage(pageIndex: number) {
    component.onPage({ pageIndex, pageSize: component.pageSize, length: component.totalElements });
    fixture.detectChanges();
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule, NoopAnimationsModule,
        RouterTestingModule.withRoutes(
          [{ path: 'owners', component: OwnerListComponent },
            { path: 'owners/add', component: OwnerAddComponent },
            { path: 'owners/:id', component: OwnerDetailComponent },
            { path: 'owners/:id/edit', component: OwnerEditComponent },
          ])],
      providers: [
        { provide: OwnerService, useClass: OwnerServiceStub },
        { provide: ActivatedRoute, useClass: ActivatedRouteStub },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    const ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners').and.returnValue(of(pageOf([testOwner], 26)));
  });

  describe('initial state', () => {
    it('asks once for the first page of 10, by name ascending, unfiltered', () => {
      fixture.detectChanges();

      expect(getOwnersSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual({ lastName: '', page: 0, size: 10, sort: 'name,asc' });
    });

    it('renders the owner rows, the range and the total', () => {
      fixture.detectChanges();

      expect(text('.ownerFullName')).toBe('George Franklin');
      expect(text('.mat-mdc-paginator-range-label')).toBe('1 – 10 of 26');
    });

    it('offers page sizes 5, 10 and 20', () => {
      fixture.detectChanges();

      const paginator: MatPaginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance;
      expect(paginator.pageSizeOptions).toEqual([5, 10, 20]);
      expect(paginator.pageSize).toBe(10);
    });

    it('makes only Name and City sortable', () => {
      fixture.detectChanges();

      const sortable = fixture.debugElement.queryAll(By.css('#ownersTable th[mat-sort-header]'))
        .map((th) => th.nativeElement.textContent.trim());
      expect(sortable).toEqual(['Name', 'City']);
      const plain = fixture.debugElement.queryAll(By.css('#ownersTable th:not([mat-sort-header])'))
        .map((th) => th.nativeElement.textContent.trim());
      expect(plain).toEqual(['Address', 'Telephone', 'Pets']);
    });

    it('keeps owner links and Add Owner', () => {
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.ownerFullName a')).attributes['href']).toBe('/owners/1');
      expect(text('#addOwner')).toBe('Add Owner');
    });
  });

  describe('one request per action', () => {
    beforeEach(() => startWith(of(pageOf([testOwner], 26))));

    it('a submitted search asks once for page 0 with the prefix', () => {
      goToPage(2);
      getOwnersSpy.calls.reset();

      submitSearch('Fr');

      expect(getOwnersSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual({ lastName: 'Fr', page: 0, size: 10, sort: 'name,asc' });
    });

    it('the next-page button asks once for the next page', () => {
      fixture.debugElement.query(By.css('.mat-mdc-paginator-navigation-next')).nativeElement.click();

      expect(getOwnersSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery().page).toBe(1);
    });

    it('the previous-page button asks once for the previous page', () => {
      goToPage(2);
      getOwnersSpy.calls.reset();

      fixture.debugElement.query(By.css('.mat-mdc-paginator-navigation-previous')).nativeElement.click();

      expect(getOwnersSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery().page).toBe(1);
    });

    it('a page-size change goes back to page 0', () => {
      goToPage(2);
      getOwnersSpy.calls.reset();

      component.onPage({ pageIndex: 1, pageSize: 5, previousPageIndex: 2, length: 26 });

      expect(getOwnersSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual(jasmine.objectContaining({ page: 0, size: 5 }));
    });

    it('clicking a sortable header toggles it and goes back to page 0, keeping the submitted filter', () => {
      submitSearch('Fr');
      goToPage(2);
      getOwnersSpy.calls.reset();

      fixture.debugElement.query(By.css('th[mat-sort-header="city"]')).nativeElement.click();
      fixture.detectChanges();
      fixture.debugElement.query(By.css('th[mat-sort-header="city"]')).nativeElement.click();
      fixture.detectChanges();

      expect(getOwnersSpy).toHaveBeenCalledTimes(2);
      expect(getOwnersSpy.calls.argsFor(0)[0]).toEqual({ lastName: 'Fr', page: 0, size: 10, sort: 'city,asc' });
      expect(lastQuery()).toEqual({ lastName: 'Fr', page: 0, size: 10, sort: 'city,desc' });
    });

    it('the active sort never clears, it alternates', () => {
      for (const expected of ['name,desc', 'name,asc', 'name,desc']) {
        fixture.debugElement.query(By.css('th[mat-sort-header="name"]')).nativeElement.click();
        fixture.detectChanges();
        expect(lastQuery().sort).toBe(expected);
      }
    });

    it('Enter on a sortable header sorts by it from the keyboard', () => {
      const keydown = new KeyboardEvent('keydown', { key: 'Enter' });
      Object.defineProperty(keydown, 'keyCode', { get: () => 13 });

      fixture.debugElement.query(By.css('th[mat-sort-header="city"]')).nativeElement.dispatchEvent(keydown);

      expect(getOwnersSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery().sort).toBe('city,asc');
    });

    it('a search keeps the active sort', () => {
      component.onSort({ active: 'city', direction: 'desc' });
      goToPage(1);
      getOwnersSpy.calls.reset();

      submitSearch('Pot');

      expect(getOwnersSpy).toHaveBeenCalledTimes(1);
      expect(lastQuery()).toEqual({ lastName: 'Pot', page: 0, size: 10, sort: 'city,desc' });
    });

    it('paging uses the submitted prefix, not text typed since', () => {
      submitSearch('Fr');
      component.lastNameDraft = 'Unsubmitted';
      getOwnersSpy.calls.reset();

      goToPage(1);

      expect(lastQuery().lastName).toBe('Fr');
    });
  });

  describe('latest request wins', () => {
    it('an initial load answering late does not overwrite a search', () => {
      const initialLoad = new Subject<OwnerPage>();
      startWith(initialLoad);
      getOwnersSpy.and.returnValue(of(pageOf([testOwner])));

      submitSearch('Franklin');
      initialLoad.next(pageOf([testOwner, davis], 26));
      initialLoad.complete();

      expect(component.owners).toEqual([testOwner]);
      expect(component.totalElements).toBe(1);
      expect(component.loading).toBeFalse();
    });

    it('an earlier request failing late neither shows an error nor ends the newer loading', () => {
      const first = new Subject<OwnerPage>();
      startWith(first);
      const second = new Subject<OwnerPage>();
      getOwnersSpy.and.returnValue(second);

      goToPage(1);
      first.error('server returned code 500');
      fixture.detectChanges();

      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeTrue();
      second.next(pageOf([davis], 26));
      expect(component.loading).toBeFalse();
      expect(component.owners).toEqual([davis]);
    });

    it('leaving the screen cancels the outstanding request', () => {
      const pending = new Subject<OwnerPage>();
      startWith(pending);

      fixture.destroy();

      expect(pending.observers).toHaveSize(0);
    });
  });

  describe('empty results and failures', () => {
    it('no match: says so with the submitted prefix and hides the paginator', () => {
      startWith(of(pageOf([testOwner], 26)));
      getOwnersSpy.and.returnValue(of(pageOf([], 0)));

      submitSearch('Zz');

      expect(text('#noOwners')).toBe('No owners with LastName starting with "Zz"');
      expect(exists('mat-paginator')).toBeFalse();
      expect(exists('#ownersError')).toBeFalse();
    });

    it('an empty page of a non-empty result keeps navigation and claims no "no match"', () => {
      startWith(of(pageOf([], 26)));
      fixture.detectChanges();

      expect(exists('#noOwners')).toBeFalse();
      expect(exists('mat-paginator')).toBeTrue();
    });

    it('a failure is shown as an error, never as "no match"', () => {
      startWith(throwError('server returned code 500'));
      fixture.detectChanges();

      expect(text('#ownersError')).toContain('server returned code 500');
      expect(exists('#noOwners')).toBeFalse();
      expect(text('#addOwner')).toBe('Add Owner');
    });

    it('a failed page keeps the paginator, so the page can be retried', () => {
      startWith(of(pageOf([testOwner], 26)));
      getOwnersSpy.and.returnValue(throwError('server returned code 503'));
      goToPage(2);
      getOwnersSpy.and.returnValue(of(pageOf([davis], 26)));

      fixture.debugElement.query(By.css('.mat-mdc-paginator-navigation-previous')).nativeElement.click();
      fixture.detectChanges();

      expect(lastQuery().page).toBe(1);
      expect(exists('#ownersError')).toBeFalse();
      expect(text('.ownerFullName')).toBe('Betty Davis');
    });

    it('shows no paginator before the first answer', () => {
      startWith(new Subject<OwnerPage>());
      fixture.detectChanges();

      expect(exists('mat-paginator')).toBeFalse();
    });

    it('a successful answer after a failure clears the error', () => {
      startWith(throwError('boom'));
      getOwnersSpy.and.returnValue(of(pageOf([testOwner])));

      submitSearch('Fr');

      expect(exists('#ownersError')).toBeFalse();
      expect(text('.ownerFullName')).toBe('George Franklin');
    });
  });
});
