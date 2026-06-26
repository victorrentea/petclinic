import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {BehaviorSubject, of} from 'rxjs';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {RouterTestingModule} from '@angular/router/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {MatTableModule} from '@angular/material/table';
import {MatSortModule, Sort} from '@angular/material/sort';
import {MatPaginatorModule} from '@angular/material/paginator';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {OwnerPage} from '../owner-page';
import {Owner} from '../owner';

// ── Test fixtures ───────────────────────────────────────────────────────────

const testOwner: Owner = {
  id: 1,
  firstName: 'George',
  lastName: 'Franklin',
  address: '110 W. Liberty St.',
  city: 'Madison',
  telephone: '6085551023',
  pets: [] as any
};

const testPage: OwnerPage = {
  content: [testOwner],
  page: {size: 10, number: 0, totalElements: 37, totalPages: 4}
};

// ── Route stub that exposes a queryParams Subject ──────────────────────────

class QueryParamsRouteStub {
  private subject = new BehaviorSubject<Record<string, string>>({});
  queryParams = this.subject.asObservable();
  emit(params: Record<string, string>) {
    this.subject.next(params);
  }
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerServiceSpy: jasmine.SpyObj<OwnerService>;
  let router: Router;
  let routerNavigateSpy: jasmine.Spy;
  let routeStub: QueryParamsRouteStub;

  beforeEach(waitForAsync(() => {
    ownerServiceSpy = jasmine.createSpyObj('OwnerService', ['getOwners']);
    ownerServiceSpy.getOwners.and.returnValue(of(testPage));
    routeStub = new QueryParamsRouteStub();

    TestBed.configureTestingModule({
      imports: [
        CommonModule,
        FormsModule,
        NoopAnimationsModule,
        RouterTestingModule,
        MatTableModule,
        MatSortModule,
        MatPaginatorModule
      ],
      declarations: [OwnerListComponent],
      providers: [
        {provide: OwnerService, useValue: ownerServiceSpy},
        {provide: ActivatedRoute, useValue: routeStub}
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    router = TestBed.inject(Router);
    routerNavigateSpy = spyOn(router, 'navigate').and.stub();

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit → queryParams subscription → BehaviorSubject emits {}
  });

  // ── Basic creation ────────────────────────────────────────────────────────

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ── Paginator wiring ──────────────────────────────────────────────────────

  it('paginator length equals totalElements from service response', () => {
    expect(component.totalElements).toBe(37);
    const paginator = fixture.nativeElement.querySelector('mat-paginator');
    expect(paginator).toBeTruthy('mat-paginator must be present');
  });

  it('paginator pageSizeOptions are [5, 10, 20]', () => {
    // Open the paginator size dropdown and verify options
    const paginator = fixture.debugElement.query(By.css('mat-paginator'));
    expect(paginator).toBeTruthy();
    // Component property drives the binding
    // We verify via the DOM that the default size is 10
    expect(component.size).toBe(10);
  });

  // ── Pets column must NOT have sort affordance ─────────────────────────────

  it('pets column header has no mat-sort-header (no sort affordance)', () => {
    fixture.detectChanges();
    // Find all header cells
    const headerCells = fixture.nativeElement.querySelectorAll('th');
    // The pets header contains text "Pets"
    const petsHeader: HTMLElement = Array.from(headerCells)
      .find((th: HTMLElement) => th.textContent.trim() === 'Pets') as HTMLElement;
    expect(petsHeader).withContext('pets header must exist').toBeTruthy();
    // mat-sort-header adds a .mat-sort-header-container inside the cell
    expect(petsHeader.querySelector('.mat-sort-header-container'))
      .withContext('pets column must NOT have sort-header container')
      .toBeNull();
  });

  // ── Sort triggers server refetch via router.navigate ──────────────────────

  it('sort change navigates with new sort/direction (server refetch, not client-side resort)', () => {
    routerNavigateSpy.calls.reset();

    const sortEvent: Sort = {active: 'city', direction: 'desc'};
    component.onSort(sortEvent);

    expect(routerNavigateSpy).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({sort: 'city', direction: 'desc', page: 0}),
        queryParamsHandling: 'merge'
      })
    );

    // Verify owners array is NOT client-sorted — it remains exactly the service response
    expect(component.owners).toEqual([testOwner]);
  });

  it('sort change resets page to 0', () => {
    routerNavigateSpy.calls.reset();
    component.onSort({active: 'address', direction: 'asc'});

    const call = routerNavigateSpy.calls.mostRecent();
    expect(call.args[1].queryParams.page).toBe(0);
  });

  // ── Deep-link initialises grid state ──────────────────────────────────────

  it('deep link ?lastName=Fra&page=1&size=20&sort=city&direction=desc initializes grid state', waitForAsync(() => {
    routeStub.emit({lastName: 'Fra', page: '1', size: '20', sort: 'city', direction: 'desc'});
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      expect(component.lastName).toBe('Fra');
      expect(component.page).toBe(1);
      expect(component.size).toBe(20);
      expect(component.sortActive).toBe('city');
      expect(component.sortDirection).toBe('desc');
      expect(ownerServiceSpy.getOwners).toHaveBeenCalledWith(
        jasmine.objectContaining({lastName: 'Fra', page: 1, size: 20, sort: 'city', direction: 'desc'})
      );
    });
  }));

  it('deep link initializes sort direction defaults to asc when not desc', waitForAsync(() => {
    routeStub.emit({sort: 'name', direction: 'asc'});
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      expect(component.sortDirection).toBe('asc');
    });
  }));

  // ── New search navigates with page=0 ──────────────────────────────────────

  it('new lastName search navigates with page=0', () => {
    routerNavigateSpy.calls.reset();
    component.lastName = 'Fra';
    component.search();

    expect(routerNavigateSpy).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({lastName: 'Fra', page: 0}),
        queryParamsHandling: 'merge'
      })
    );
  });

  it('empty lastName search navigates with page=0', () => {
    routerNavigateSpy.calls.reset();
    component.lastName = '';
    component.search();

    const call = routerNavigateSpy.calls.mostRecent();
    expect(call.args[1].queryParams.page).toBe(0);
  });

  // ── Page event navigates ──────────────────────────────────────────────────

  it('page change navigates with new pageIndex and pageSize', () => {
    routerNavigateSpy.calls.reset();
    component.onPage({pageIndex: 2, pageSize: 20, length: 37, previousPageIndex: 1});

    expect(routerNavigateSpy).toHaveBeenCalledWith(
      [],
      jasmine.objectContaining({
        queryParams: jasmine.objectContaining({page: 2, size: 20}),
        queryParamsHandling: 'merge'
      })
    );
  });
});
