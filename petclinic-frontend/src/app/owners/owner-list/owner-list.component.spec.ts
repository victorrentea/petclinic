import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatPaginator } from '@angular/material/paginator';
import { Observable, of, Subject, throwError } from 'rxjs';
import Spy = jasmine.Spy;

import { OwnerListComponent } from './owner-list.component';
import { OwnerService } from '../owner.service';
import { OwnersModule } from '../owners.module';
import { Owner } from '../owner';
import { DEFAULT_OWNER_PAGE_QUERY, OwnerPage, OwnerPageQuery } from '../owner-page';

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let getOwnerPage: Spy<(query?: OwnerPageQuery) => Observable<OwnerPage>>;

  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  const tenOwners: Owner[] = Array.from({length: 10}, (_, i) => ({...testOwner, id: i + 1}));
  const page = (content: Owner[], totalElements: number): OwnerPage => ({content, totalElements});

  beforeEach(async () => {
    getOwnerPage = jasmine.createSpy('getOwnerPage').and.returnValue(of(page(tenOwners, 26)));
    await TestBed.configureTestingModule({
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{provide: OwnerService, useValue: {getOwnerPage}}]
    }).compileComponents();
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
  });

  const query = (overrides: Partial<OwnerPageQuery>): OwnerPageQuery => ({...DEFAULT_OWNER_PAGE_QUERY, ...overrides});
  const element = (css: string): HTMLElement | null => fixture.nativeElement.querySelector(css);
  const text = (css: string): string => element(css)?.textContent?.trim() ?? '';
  const render = () => fixture.detectChanges();
  const openAndForgetCalls = () => {
    render();
    getOwnerPage.calls.reset();
  };

  describe('requests', () => {
    it('opens on the first page of 10 by name ascending', () => {
      render();

      expect(getOwnerPage).toHaveBeenCalledOnceWith(DEFAULT_OWNER_PAGE_QUERY);
    });

    it('a submitted search asks for page 0 with the new prefix, keeping the sort', () => {
      render();
      component.onSort({active: 'city', direction: 'desc'});
      component.onPage({pageIndex: 2, pageSize: 10, length: 26});
      getOwnerPage.calls.reset();

      component.draftLastName = 'Fr';
      component.search();

      expect(getOwnerPage).toHaveBeenCalledOnceWith(query({lastName: 'Fr', sort: 'city', direction: 'desc'}));
    });

    it('page navigation keeps the submitted prefix, not the unsubmitted input', () => {
      render();
      component.draftLastName = 'Fr';
      component.search();
      component.draftLastName = 'Zz';
      getOwnerPage.calls.reset();

      component.onPage({pageIndex: 1, pageSize: 10, length: 26});

      expect(getOwnerPage).toHaveBeenCalledOnceWith(query({lastName: 'Fr', page: 1}));
    });

    it('changing the page size goes back to page 0', () => {
      render();
      component.onPage({pageIndex: 2, pageSize: 10, length: 26});
      getOwnerPage.calls.reset();

      component.onPage({pageIndex: 1, pageSize: 20, length: 26, previousPageIndex: 2});

      expect(getOwnerPage).toHaveBeenCalledOnceWith(query({size: 20}));
    });

    it('changing the sort goes back to page 0', () => {
      render();
      component.onPage({pageIndex: 2, pageSize: 10, length: 26});
      getOwnerPage.calls.reset();

      component.onSort({active: 'name', direction: 'desc'});

      expect(getOwnerPage).toHaveBeenCalledOnceWith(query({direction: 'desc'}));
    });

    it('one click on Find Owner sends exactly one request', () => {
      openAndForgetCalls();

      (element('#search-owner-form button[type=submit]') as HTMLButtonElement).click();

      expect(getOwnerPage).toHaveBeenCalledTimes(1);
    });
  });

  describe('latest request wins', () => {
    it('an earlier answer arriving late does not overwrite the latest page', () => {
      const initialLoad = new Subject<OwnerPage>();
      getOwnerPage.and.returnValues(initialLoad, of(page([testOwner], 1)));
      render();

      component.draftLastName = 'Franklin';
      component.search();
      initialLoad.next(page(tenOwners, 26));

      expect(component.owners).toEqual([testOwner]);
      expect(component.totalElements).toBe(1);
      expect(component.loading).toBeFalse();
    });

    it('an earlier failure or completion does not touch the pending latest request', () => {
      const initialLoad = new Subject<OwnerPage>();
      const latest = new Subject<OwnerPage>();
      getOwnerPage.and.returnValues(initialLoad, latest);
      render();
      component.search();

      initialLoad.error('server returned code 500');
      expect(component.errorMessage).toBeNull();
      expect(component.loading).toBeTrue();

      latest.next(page([testOwner], 1));
      latest.complete();
      expect(component.loading).toBeFalse();
      expect(component.owners).toEqual([testOwner]);
    });

    it('an earlier completion does not end the latest loading', () => {
      const initialLoad = new Subject<OwnerPage>();
      getOwnerPage.and.returnValues(initialLoad, new Subject<OwnerPage>());
      render();
      component.search();

      initialLoad.complete();

      expect(component.loading).toBeTrue();
    });

    it('leaving the screen cancels the outstanding request', () => {
      const pending = new Subject<OwnerPage>();
      getOwnerPage.and.returnValue(pending);
      render();

      fixture.destroy();

      expect(pending.observers.length).toBe(0);
    });
  });

  describe('empty results and failures', () => {
    it('a zero total shows the no-owners message for the submitted prefix and hides the paginator', () => {
      openAndForgetCalls();
      getOwnerPage.and.returnValue(of(page([], 0)));
      component.draftLastName = 'Zz';
      component.search();
      component.draftLastName = 'Yy';
      render();

      expect(text('#noOwners')).toBe('No owners with LastName starting with "Zz"');
      expect(element('mat-paginator')).toBeNull();
      expect(element('#ownersError')).toBeNull();
    });

    it('an empty page of a nonzero total keeps navigation and claims no "no matches"', () => {
      getOwnerPage.and.returnValue(of(page([], 26)));
      render();

      expect(element('#noOwners')).toBeNull();
      expect(element('mat-paginator')).not.toBeNull();
    });

    it('a failed request shows an explicit error, not an empty result', () => {
      getOwnerPage.and.returnValue(throwError('server returned code 500'));
      render();

      expect(text('#ownersError')).toContain('server returned code 500');
      expect(element('#noOwners')).toBeNull();
      expect(element('mat-paginator')).toBeNull();
    });

    it('Add Owner stays available while loading, on no matches and on failure', () => {
      getOwnerPage.and.returnValues(new Subject<OwnerPage>(), of(page([], 0)), throwError('boom'));
      render();
      expect(element('#addOwner')).withContext('loading').not.toBeNull();

      component.search();
      render();
      expect(element('#addOwner')).withContext('no matches').not.toBeNull();

      component.search();
      render();
      expect(element('#addOwner')).withContext('failure').not.toBeNull();
    });
  });

  describe('grid', () => {
    it('lists the owners linking to their details', () => {
      render();

      expect(fixture.nativeElement.querySelectorAll('#ownersTable tbody .ownerFullName').length).toBe(10);
      expect(text('.ownerFullName')).toBe('George Franklin');
      expect(element('.ownerFullName a')?.getAttribute('href')).toBe('/owners/1');
    });

    it('shows the range and total, and offers 5, 10 and 20 rows per page', () => {
      render();

      expect(text('.mat-mdc-paginator-range-label')).toBe('1 – 10 of 26');
      const paginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance as MatPaginator;
      expect(paginator.pageSizeOptions).toEqual([5, 10, 20]);
      expect(paginator.pageSize).toBe(10);
    });

    it('next and previous buttons request the adjacent pages', () => {
      openAndForgetCalls();

      element('.mat-mdc-paginator-navigation-next')!.click();
      render();
      expect(getOwnerPage).toHaveBeenCalledOnceWith(query({page: 1}));
      expect(text('.mat-mdc-paginator-range-label')).toBe('11 – 20 of 26');

      getOwnerPage.calls.reset();
      element('.mat-mdc-paginator-navigation-previous')!.click();
      expect(getOwnerPage).toHaveBeenCalledOnceWith(query({page: 0}));
    });

    it('only Name and City are sortable', () => {
      render();

      const sortable: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('th[mat-sort-header]'));
      expect(sortable.map(th => th.textContent?.trim())).toEqual(['Name', 'City']);
      expect(fixture.nativeElement.querySelectorAll('#ownersTable th').length).toBe(5);
    });

    it('clicking a header toggles its direction and never clears the sort', () => {
      openAndForgetCalls();
      const city = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))[1].nativeElement as HTMLElement;

      city.click();
      city.click();
      city.click();

      expect(getOwnerPage.calls.allArgs().map(([q]) => `${q?.sort},${q?.direction}`))
        .toEqual(['city,asc', 'city,desc', 'city,asc']);
    });

    it('sorts from the keyboard', () => {
      openAndForgetCalls();
      const name = element('th[mat-sort-header]')!;
      const enter = new KeyboardEvent('keydown', {key: 'Enter'});
      Object.defineProperty(enter, 'keyCode', {get: () => 13});

      name.dispatchEvent(enter);

      expect(getOwnerPage).toHaveBeenCalledOnceWith(query({direction: 'desc'}));
    });
  });
});
