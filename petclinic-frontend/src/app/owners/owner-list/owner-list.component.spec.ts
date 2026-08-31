/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner, OwnerPage} from '../owner';
import {Observable, of} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {PartsModule} from '../../parts/parts.module';
import {ActivatedRouteStub} from '../../testing/router-stubs';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwners(): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let navigateSpy: Spy;
  let route: ActivatedRouteStub;
  let de: DebugElement;
  let el: HTMLElement;


  const testOwner: Owner = {
    id: 1,
    firstName: 'Harry',
    lastName: 'Potter',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };

  function pageOf(owners: Owner[], number = 0, size = 10, totalElements = owners.length): OwnerPage {
    return {
      content: owners,
      page: {size, number, totalElements, totalPages: Math.ceil(totalElements / size)}
    };
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      imports: [CommonModule, FormsModule, NoopAnimationsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes(
          [{path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [
        {provide: OwnerService, useValue: ownerService},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    route = TestBed.inject(ActivatedRoute) as unknown as ActivatedRouteStub;
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(pageOf([testOwner], 0, 10, 26)));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('fetches the default page on init', () => {
    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith(
      {page: 0, size: 10, sort: 'lastName,asc', lastName: ''});
    expect(component.totalElements).toBe(26);
  });

  it('shows the name family-name first', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      de = fixture.debugElement.query(By.css('td.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText).toBe('Potter, Harry');
    });
  }));

  it('renders the paginator and only the Name and City headers are sortable', () => {
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-test="owners-paginator"]'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('th[data-test="sort-name"].mat-sort-header'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('th[data-test="sort-city"].mat-sort-header'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('th.mat-sort-header')).length).toBe(2);
  });

  it('honours a deep-linked page, size, sort and filter', () => {
    route.setQueryParams({page: '2', size: '5', sort: 'city,desc', lastName: 'Pot'});

    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith(
      {page: 2, size: 5, sort: 'city,desc', lastName: 'Pot'});
    expect(component.pageIndex).toBe(2);
    expect(component.pageSize).toBe(5);
    expect(component.sortActive).toBe('city');
    expect(component.sortDirection).toBe('desc');
    expect(component.lastName).toBe('Pot');
  });

  it('searching resets to page 0 and keeps the current sort', () => {
    route.setQueryParams({page: '5', size: '5', sort: 'city,asc'});
    fixture.detectChanges();
    navigateSpy.calls.reset();

    component.searchByLastName('Pot');

    const queryParams = navigateSpy.calls.mostRecent().args[1].queryParams;
    expect(queryParams).toEqual({page: 0, lastName: 'Pot'});
    expect(navigateSpy.calls.mostRecent().args[1].queryParamsHandling).toBe('merge');
  });

  it('clearing the search drops the lastName query param', () => {
    fixture.detectChanges();
    navigateSpy.calls.reset();

    component.searchByLastName('');

    expect(navigateSpy.calls.mostRecent().args[1].queryParams).toEqual({page: 0, lastName: null});
  });

  it('changing page navigates with the new page and size', () => {
    fixture.detectChanges();
    navigateSpy.calls.reset();

    component.onPageChange({pageIndex: 3, pageSize: 20, length: 26, previousPageIndex: 0});

    expect(navigateSpy.calls.mostRecent().args[1].queryParams).toEqual({page: 3, size: 20});
  });

  it('changing sort navigates back to page 0', () => {
    fixture.detectChanges();
    navigateSpy.calls.reset();

    component.onSortChange({active: 'city', direction: 'desc'});

    expect(navigateSpy.calls.mostRecent().args[1].queryParams).toEqual({page: 0, sort: 'city,desc'});
  });

});
