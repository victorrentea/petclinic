/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement, NO_ERRORS_SCHEMA } from '@angular/core';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { OwnerService } from '../owner.service';
import { Owner, OwnerPage } from '../owner';
import { Observable, Subject, of } from 'rxjs';
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


const testOwner: Owner = {
  id: 1,
  firstName: 'George',
  lastName: 'Franklin',
  address: '110 W. Liberty St.',
  city: 'Madison',
  telephone: '6085551023',
  pets: []
};

function makeOwnerPage(owners: Owner[], page = 0, size = 10, total = owners.length): OwnerPage {
  return {
    content: owners,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    number: page,
    size
  };
}

class OwnerServiceStub {
  getOwners(): Observable<Owner[]> {
    return of([]);
  }

  searchOwners(q: string): Observable<Owner[]> {
    return of([]);
  }

  getOwnersPaged(q: string, page: number, size: number, sort: string, direction: string): Observable<OwnerPage> {
    return of(makeOwnerPage([]));
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: OwnerServiceStub;
  let getOwnersPagedSpy: Spy;
  let routeStub: ActivatedRouteStub;
  let router: Router;
  let navigateSpy: Spy;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, ReactiveFormsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes(
          [{ path: 'owners', component: OwnerListComponent },
            { path: 'owners/add', component: OwnerAddComponent },
            { path: 'owners/:id', component: OwnerDetailComponent },
            { path: 'owners/:id/edit', component: OwnerEditComponent }
          ])],
      providers: [
        { provide: OwnerService, useClass: OwnerServiceStub },
        { provide: ActivatedRoute, useClass: ActivatedRouteStub }
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService) as any;
    routeStub = fixture.debugElement.injector.get(ActivatedRoute) as any;
    router = fixture.debugElement.injector.get(Router);
    navigateSpy = spyOn(router, 'navigate').and.callThrough();
    getOwnersPagedSpy = spyOn(ownerService, 'getOwnersPaged').and.returnValue(of(makeOwnerPage([testOwner])));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('shows full name after initial load', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    const de: DebugElement = fixture.debugElement.query(By.css('.ownerFullName'));
    expect(de.nativeElement.innerText).toBe(testOwner.firstName + ' ' + testOwner.lastName);
  }));

  it('default state loads page 0, size 10, sort name asc', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);

    expect(getOwnersPagedSpy).toHaveBeenCalledWith('', 0, 10, 'name', 'asc');
  }));

  it('reads initial state from queryParams', fakeAsync(() => {
    routeStub.setQueryParams({ q: 'Fran', page: '2', size: '5', sort: 'city', direction: 'desc' });
    getOwnersPagedSpy.and.returnValue(of(makeOwnerPage([testOwner], 2, 5, 15)));

    fixture.detectChanges();
    tick(0);

    expect(getOwnersPagedSpy).toHaveBeenCalledWith('Fran', 2, 5, 'city', 'desc');
    expect(component.q).toBe('Fran');
    expect(component.page).toBe(2);
    expect(component.sort).toBe('city');
    expect(component.direction).toBe('desc');
  }));

  it('debounces typing then navigates with page=0', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    navigateSpy.calls.reset();

    component.searchControl.setValue('F');
    tick(100);
    component.searchControl.setValue('Fr');
    tick(100);
    component.searchControl.setValue('Fra');
    tick(300); // exceed debounce window

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const args = navigateSpy.calls.mostRecent().args;
    expect(args[1].queryParams.q).toBe('Fra');
    expect(args[1].queryParams.page).toBe(0);
  }));

  it('typing in search resets page to 0', fakeAsync(() => {
    // Start on page 2
    routeStub.setQueryParams({ q: '', page: '2', size: '10', sort: 'name', direction: 'asc' });
    fixture.detectChanges();
    tick(0);
    navigateSpy.calls.reset();

    component.searchControl.setValue('Madison');
    tick(300);

    const args = navigateSpy.calls.mostRecent().args;
    expect(args[1].queryParams.page).toBe(0);
  }));

  it('clicking Name header sets sort to name asc if not already sorted', fakeAsync(() => {
    routeStub.setQueryParams({ sort: 'city', direction: 'asc' });
    fixture.detectChanges();
    tick(0);
    navigateSpy.calls.reset();

    component.onSortHeader('name');

    const args = navigateSpy.calls.mostRecent().args;
    expect(args[1].queryParams.sort).toBe('name');
    expect(args[1].queryParams.direction).toBe('asc');
  }));

  it('clicking Name header toggles sort direction from asc to desc', fakeAsync(() => {
    routeStub.setQueryParams({ sort: 'name', direction: 'asc' });
    fixture.detectChanges();
    tick(0);
    navigateSpy.calls.reset();

    component.onSortHeader('name');

    const args = navigateSpy.calls.mostRecent().args;
    expect(args[1].queryParams.sort).toBe('name');
    expect(args[1].queryParams.direction).toBe('desc');
  }));

  it('clicking Name header toggles sort direction from desc to asc', fakeAsync(() => {
    routeStub.setQueryParams({ sort: 'name', direction: 'desc' });
    fixture.detectChanges();
    tick(0);
    navigateSpy.calls.reset();

    component.onSortHeader('name');

    const args = navigateSpy.calls.mostRecent().args;
    expect(args[1].queryParams.direction).toBe('asc');
  }));

  it('sliding window shows 5 pages centered on current page', fakeAsync(() => {
    // 10 total pages, current page = 5 → window should be [3, 4, 5, 6, 7]
    getOwnersPagedSpy.and.returnValue(of(makeOwnerPage([testOwner], 5, 10, 100)));
    routeStub.setQueryParams({ page: '5', size: '10' });
    fixture.detectChanges();
    tick(0);

    expect(component.pageWindowNumbers).toEqual([3, 4, 5, 6, 7]);
  }));

  it('sliding window is clamped at start boundary', fakeAsync(() => {
    // 10 total pages, current page = 1 → window should start at 0
    getOwnersPagedSpy.and.returnValue(of(makeOwnerPage([testOwner], 1, 10, 100)));
    routeStub.setQueryParams({ page: '1', size: '10' });
    fixture.detectChanges();
    tick(0);

    expect(component.pageWindowNumbers).toEqual([0, 1, 2, 3, 4]);
  }));

  it('sliding window is clamped at end boundary', fakeAsync(() => {
    // 10 total pages, current page = 9 → window should end at 9
    getOwnersPagedSpy.and.returnValue(of(makeOwnerPage([testOwner], 9, 10, 100)));
    routeStub.setQueryParams({ page: '9', size: '10' });
    fixture.detectChanges();
    tick(0);

    expect(component.pageWindowNumbers).toEqual([5, 6, 7, 8, 9]);
  }));

  it('renders race-safe via switchMap — only latest result shown', fakeAsync(() => {
    const slow = new Subject<OwnerPage>();
    const fast = new Subject<OwnerPage>();
    getOwnersPagedSpy.and.returnValues(slow.asObservable(), fast.asObservable());

    fixture.detectChanges();
    tick(0);

    // Trigger second query param change
    routeStub.setQueryParams({ q: 'Fra' });
    tick(0);

    const staleOwner: Owner = { ...testOwner, id: 999, firstName: 'STALE', lastName: 'STALE' };
    fast.next(makeOwnerPage([testOwner]));
    fast.complete();
    slow.next(makeOwnerPage([staleOwner]));
    slow.complete();

    expect(component.ownerPage.content).toEqual([testOwner]);
  }));

  it('record range shows X-Y of Z', fakeAsync(() => {
    // page 1, size 10, total 25 → Records 11-20 of 25
    getOwnersPagedSpy.and.returnValue(of(makeOwnerPage([testOwner], 1, 10, 25)));
    routeStub.setQueryParams({ page: '1', size: '10' });
    fixture.detectChanges();
    tick(0);

    expect(component.recordStart).toBe(11);
    expect(component.recordEnd).toBe(20);
    expect(component.ownerPage.totalElements).toBe(25);
  }));

  it('isFirstPage is true when page=0', fakeAsync(() => {
    fixture.detectChanges();
    tick(0);
    expect(component.isFirstPage).toBeTrue();
  }));

  it('isLastPage is true when on last page', fakeAsync(() => {
    getOwnersPagedSpy.and.returnValue(of(makeOwnerPage([testOwner], 0, 10, 5)));
    fixture.detectChanges();
    tick(0);
    expect(component.isLastPage).toBeTrue();
  }));
});
