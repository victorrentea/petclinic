/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {Observable, of, Subject} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {PartsModule} from '../../parts/parts.module';
import {ActivatedRouteStub} from '../../testing/router-stubs';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwners(query: any): Observable<OwnerPage> {
    return of({content: [], totalElements: 0});
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let activatedRoute: ActivatedRouteStub;
  let router: Router;
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
  let testOwnerPage: OwnerPage;

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
    testOwnerPage = {content: [testOwner], totalElements: 1};

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    activatedRoute = fixture.debugElement.injector.get(ActivatedRoute) as any;
    router = fixture.debugElement.injector.get(Router);
    spyOn(router, 'navigate');
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testOwnerPage));

  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('reads the state from the URL and requests that page', () => {
    activatedRoute.testQueryParams = {lastName: 'Fr', sort: 'city', dir: 'desc', page: '2', size: '20'};
    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: 'Fr', sort: 'city', dir: 'desc', page: 2, size: 20});
  });

  it('defaults to name asc, page 0, size 10 when the URL carries no state', () => {
    activatedRoute.testQueryParams = {};
    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', sort: 'name', dir: 'asc', page: 0, size: 10});
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

  it('search() navigates with page reset to 0', () => {
    activatedRoute.testQueryParams = {page: '3', size: '20'};
    fixture.detectChanges();

    component.lastName = 'Davis';
    component.search();

    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({lastName: 'Davis', page: 0})
    }));
  });

  it('onSortChange() navigates with page reset to 0', () => {
    activatedRoute.testQueryParams = {page: '3'};
    fixture.detectChanges();

    component.onSortChange({active: 'city', direction: 'desc'});

    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({sort: 'city', dir: 'desc', page: 0})
    }));
  });

  it('changing the page size navigates with page reset to 0', () => {
    activatedRoute.testQueryParams = {page: '3', size: '10'};
    fixture.detectChanges();

    component.onPageChange({pageIndex: 0, pageSize: 20, length: 100} as any);

    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: jasmine.objectContaining({size: 20, page: 0})
    }));
  });

  it('paging keeps the other params', () => {
    activatedRoute.testQueryParams = {lastName: 'Fr', sort: 'city', dir: 'desc', size: '20'};
    fixture.detectChanges();

    component.onPageChange({pageIndex: 2, pageSize: 20, length: 100} as any);

    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {lastName: 'Fr', sort: 'city', dir: 'desc', size: 20, page: 2}
    }));
  });

});
