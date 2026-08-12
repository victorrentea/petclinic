/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
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

const testOwner: Owner = {
  id: 1,
  firstName: 'George',
  lastName: 'Franklin',
  address: '110 W. Liberty St.',
  city: 'Madison',
  telephone: '6085551023',
  pets: []
};

const testPage: OwnerPage = {
  content: [testOwner],
  page: { totalElements: 1, totalPages: 1, number: 0, size: 10 }
};

class OwnerServiceStub {
  getOwners(page = 0, size = 10, sort = 'name', direction = 'asc'): Observable<OwnerPage> {
    return of(testPage);
  }

  searchOwners(lastName: string, page = 0, size = 10, sort = 'name', direction = 'asc'): Observable<OwnerPage> {
    return of(testPage);
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let searchOwnersSpy: Spy;
  let de: DebugElement;
  let el: HTMLElement;

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
    getOwnersSpy = spyOn(ownerService, 'getOwners').and.returnValue(of(testPage));
    searchOwnersSpy = spyOn(ownerService, 'searchOwners').and.returnValue(of(testPage));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('default load calls getOwners with page=0, size=10, sort=name, direction=asc', () => {
    fixture.detectChanges();
    expect(getOwnersSpy).toHaveBeenCalledWith(0, 10, 'name', 'asc');
  });

  it('Name column renders "lastName firstName" (last name first, single space)', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText).toContain('Franklin George');
    });
  }));

  it('clicking Name header sorts by name asc on first click', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();

    component.sortBy('name'); // already sorted by name, should flip to desc
    expect(getOwnersSpy).toHaveBeenCalledWith(0, 10, 'name', 'desc');
  });

  it('clicking City header sorts by city asc (switching from name)', () => {
    fixture.detectChanges();
    component.sortKey = 'name';
    getOwnersSpy.calls.reset();

    component.sortBy('city');
    expect(getOwnersSpy).toHaveBeenCalledWith(0, 10, 'city', 'asc');
  });

  it('re-clicking the active sort column flips direction', () => {
    fixture.detectChanges();
    component.sortKey = 'city';
    component.sortDirection = 'asc';
    getOwnersSpy.calls.reset();

    component.sortBy('city');
    expect(component.sortDirection).toBe('desc');
  });

  it('new search resets to page 0 while keeping page size and sort', () => {
    fixture.detectChanges();
    component.currentPage = 2;
    component.pageSize = 20;
    component.sortKey = 'city';
    component.sortDirection = 'desc';
    searchOwnersSpy.calls.reset();

    component.searchByLastName('Fr');
    expect(component.currentPage).toBe(0);
    expect(searchOwnersSpy).toHaveBeenCalledWith('Fr', 0, 20, 'city', 'desc');
  });

  it('paginator interaction requests right page and size', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();

    component.onPageChange({ pageIndex: 2, pageSize: 5, length: 15, previousPageIndex: 0 });
    expect(getOwnersSpy).toHaveBeenCalledWith(2, 5, 'name', 'asc');
  });

  it('searchByLastName calls getOwners for empty term', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchByLastName('');
    expect(getOwnersSpy).toHaveBeenCalled();
    expect(searchOwnersSpy).not.toHaveBeenCalled();
  });

  it('searchByLastName calls searchOwners for non-empty term with page/sort params', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchByLastName('Fr');
    expect(searchOwnersSpy).toHaveBeenCalledWith('Fr', 0, 10, 'name', 'asc');
    expect(getOwnersSpy).not.toHaveBeenCalled();
  });
});
