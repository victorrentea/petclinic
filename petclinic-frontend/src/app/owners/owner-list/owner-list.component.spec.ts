import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import Spy = jasmine.Spy;

import { OwnerListComponent } from './owner-list.component';
import { OwnerService } from '../owner.service';
import { OwnersModule } from '../owners.module';
import { Owner } from '../owner';
import { FIRST_OWNER_PAGE, OwnerPage, OwnerPageQuery } from '../owner-page';
import { DummyComponent } from '../../testing/dummy.component';

class OwnerServiceStub {
  getOwnerPage(query?: OwnerPageQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let getOwnerPageSpy: Spy;

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
  const pageOf = (content: Owner[], totalElements: number): OwnerPage => ({content, totalElements});

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule.withRoutes([])],
      providers: [{provide: OwnerService, useClass: OwnerServiceStub}]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    getOwnerPageSpy = spyOn(TestBed.inject(OwnerService), 'getOwnerPage')
      .and.returnValue(of(pageOf([george], 26)));
  });

  const lastQuery = (): OwnerPageQuery => getOwnerPageSpy.calls.mostRecent().args[0];
  const query = (css: string) => fixture.debugElement.query(By.css(css));
  const text = (css: string): string => query(css)?.nativeElement.textContent.trim();
  // async: ngModel wires its form control only once the first change detection has settled
  const submitSearch = async (lastName: string) => {
    await fixture.whenStable();
    const input: HTMLInputElement = query('#lastName').nativeElement;
    input.value = lastName;
    input.dispatchEvent(new Event('input'));
    query('#search-owner-form button[type="submit"]').nativeElement.click();
    fixture.detectChanges();
  };
  const goToPage = (pageIndex: number) => {
    component.onPage({pageIndex, pageSize: component.pageSize, length: 26});
    fixture.detectChanges();
  };

  describe('on open', () => {
    it('requests the first page as the API defaults it, once', () => {
      fixture.detectChanges();

      expect(getOwnerPageSpy).toHaveBeenCalledOnceWith(FIRST_OWNER_PAGE);
    });

    it('lists the page owners with links to their details', () => {
      fixture.detectChanges();

      const link = query('#ownersTable td.ownerFullName a');
      expect(link.nativeElement.textContent.trim()).toBe('George Franklin');
      expect(link.nativeElement.getAttribute('href')).toBe('/owners/1');
    });

    it('shows the range and total, with page sizes 5, 10 and 20', () => {
      fixture.detectChanges();

      expect(text('.mat-mdc-paginator-range-label')).toBe('1 – 10 of 26');
      expect(component.pageSizeOptions).toEqual([5, 10, 20]);
    });

    it('lets only Name and City be sorted', () => {
      fixture.detectChanges();

      const headers = fixture.debugElement.queryAll(By.css('#ownersTable th'));
      const sortable = headers.filter((th) => th.attributes['mat-sort-header'] !== undefined)
        .map((th) => th.nativeElement.textContent.trim());
      expect(sortable).toEqual(['Name', 'City']);
      expect(headers.length).toBe(5);
    });

    it('offers Add Owner', () => {
      fixture.detectChanges();

      expect(text('#addOwner')).toBe('Add Owner');
    });
  });

  describe('sends exactly one request', () => {
    beforeEach(() => {
      fixture.detectChanges();
      getOwnerPageSpy.calls.reset();
    });

    it('for the next page, keeping filter, size and sort', () => {
      query('.mat-mdc-paginator-navigation-next').nativeElement.click();
      fixture.detectChanges();

      expect(getOwnerPageSpy).toHaveBeenCalledOnceWith({...FIRST_OWNER_PAGE, page: 1});
    });

    it('for the previous page', () => {
      goToPage(2);
      getOwnerPageSpy.calls.reset();

      query('.mat-mdc-paginator-navigation-previous').nativeElement.click();

      expect(getOwnerPageSpy).toHaveBeenCalledOnceWith({...FIRST_OWNER_PAGE, page: 1});
    });

    it('per submitted search, from page 0, keeping the sort', async () => {
      component.onSort({active: 'city', direction: 'desc'});
      goToPage(2);
      getOwnerPageSpy.calls.reset();

      await submitSearch('Fr');

      expect(getOwnerPageSpy).toHaveBeenCalledOnceWith({lastName: 'Fr', page: 0, size: 10, sort: 'city,desc'});
    });

    it('per page-size change, from page 0', () => {
      goToPage(2);
      getOwnerPageSpy.calls.reset();

      component.onPage({pageIndex: 1, pageSize: 20, previousPageIndex: 2, length: 26});

      expect(getOwnerPageSpy).toHaveBeenCalledOnceWith({...FIRST_OWNER_PAGE, size: 20});
    });

    it('per sort toggle, from page 0', () => {
      goToPage(2);
      getOwnerPageSpy.calls.reset();

      query('th[mat-sort-header="name"]').nativeElement.click();

      expect(getOwnerPageSpy).toHaveBeenCalledOnceWith({...FIRST_OWNER_PAGE, sort: 'name,desc'});
    });

    it('per sort chosen with the keyboard', () => {
      const city = query('th[mat-sort-header="city"]');
      city.triggerEventHandler('keydown', {keyCode: 13, preventDefault: () => {}});

      expect(getOwnerPageSpy).toHaveBeenCalledOnceWith({...FIRST_OWNER_PAGE, sort: 'city,asc'});
    });
  });

  it('pages through the submitted filter, not the unsubmitted input', async () => {
    fixture.detectChanges();
    await submitSearch('Fr');
    const input: HTMLInputElement = query('#lastName').nativeElement;
    input.value = 'Zz';
    input.dispatchEvent(new Event('input'));

    goToPage(1);

    expect(lastQuery().lastName).toBe('Fr');
  });

  describe('latest request wins', () => {
    it('over an initial load that answers late', async () => {
      const initialLoad = new Subject<OwnerPage>();
      getOwnerPageSpy.and.returnValues(initialLoad, of(pageOf([george], 1)));
      fixture.detectChanges();

      await submitSearch('Franklin');
      initialLoad.next(pageOf([george, betty], 26));

      expect(component.owners).toEqual([george]);
      expect(component.totalElements).toBe(1);
    });

    it('over an earlier page that fails or completes late', () => {
      const earlier = new Subject<OwnerPage>();
      const latest = new Subject<OwnerPage>();
      getOwnerPageSpy.and.returnValues(earlier, latest);
      fixture.detectChanges();

      goToPage(1);
      earlier.error('too late');
      earlier.complete();

      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeTrue();
      latest.next(pageOf([betty], 26));
      latest.complete();
      expect(component.loading).toBeFalse();
      expect(component.owners).toEqual([betty]);
    });

    it('and leaving the screen cancels it', () => {
      const pending = new Subject<OwnerPage>();
      getOwnerPageSpy.and.returnValue(pending);
      fixture.detectChanges();

      fixture.destroy();

      expect(pending.observers.length).toBe(0);
    });
  });

  describe('empty results and failures', () => {
    it('says no owner matches the submitted prefix, without a paginator', async () => {
      fixture.detectChanges();
      getOwnerPageSpy.and.returnValue(of(pageOf([], 0)));

      await submitSearch('Zzzz');

      expect(text('#noOwners')).toBe('No owners with LastName starting with "Zzzz"');
      expect(query('mat-paginator')).toBeNull();
      expect(query('#ownersTable')).toBeNull();
    });

    it('keeps navigation on an empty page beyond a nonzero total', () => {
      getOwnerPageSpy.and.returnValue(of(pageOf([], 26)));
      fixture.detectChanges();

      expect(query('#noOwners')).toBeNull();
      expect(query('mat-paginator')).not.toBeNull();
    });

    it('shows a failure as an error, not as no matches', () => {
      getOwnerPageSpy.and.returnValue(throwError(() => 'server returned code 500'));
      fixture.detectChanges();

      expect(text('#ownersError')).toContain('server returned code 500');
      expect(query('#noOwners')).toBeNull();
      expect(text('#addOwner')).toBe('Add Owner');
    });
  });
});
