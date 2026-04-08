/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {Observable, of} from 'rxjs';
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
  getOwners(params: any): Observable<any> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let de: DebugElement;
  let el: HTMLElement;


  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  let testOwners: Owner[];

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule,
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
    testOwners = [testOwner];

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of({
        content: testOwners,
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 10
      }));

  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call ngOnInit() method', () => {
    fixture.detectChanges();
    expect(getOwnersSpy.calls.any()).toBe(true, 'getOwners called');
  });


  it(' should show full name after getOwners observable (async) ', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => { // wait for async getOwners
      fixture.detectChanges();        // update view with name
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText).toBe((testOwner.firstName.toString() + ' ' + testOwner.lastName.toString()));
    });
  }));

  it('searchByLastName should call getOwners', () => {
    getOwnersSpy.calls.reset();

    component.searchByLastName('Fr');

    expect(getOwnersSpy).toHaveBeenCalled();
  });

  it('sortBy name: first click sends name,asc then second click sends name,desc', () => {
    fixture.detectChanges();
    // Reset to a different column so first click on 'name' sets asc
    component.sortColumn = 'city';
    component.sortOrder = 'asc';
    getOwnersSpy.calls.reset();

    component.sortBy('name');
    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ sort: 'name', order: 'asc' })
    );

    getOwnersSpy.calls.reset();
    component.sortBy('name');
    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ sort: 'name', order: 'desc' })
    );
  });

  it('onPageSizeChange resets to page 0', () => {
    fixture.detectChanges();
    component.currentPage = 3;
    getOwnersSpy.calls.reset();

    component.onPageSizeChange(20);

    expect(component.currentPage).toBe(0);
    expect(component.pageSize).toBe(20);
    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 0, size: 20 })
    );
  });

  it('searchControl change resets to page 0', fakeAsync(() => {
    fixture.detectChanges();
    component.currentPage = 5;
    getOwnersSpy.calls.reset();

    component.searchControl.setValue('smith');
    tick(500); // wait for debounce

    expect(component.currentPage).toBe(0);
    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 0, q: 'smith' })
    );
  }));

  it('goToPage navigates to correct page', () => {
    fixture.detectChanges();
    component.totalPages = 5;
    component.currentPage = 2;
    getOwnersSpy.calls.reset();

    component.goToPage(4);

    expect(component.currentPage).toBe(4);
    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 4 })
    );
  });

});
