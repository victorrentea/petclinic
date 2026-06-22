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
  let testPage: OwnerPage;

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
    testPage = {
      content: [testOwner],
      totalElements: 25,
      totalPages: 3,
      number: 0,
      size: 10
    };

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.callFake((params: any = {}) => of({...testPage, number: params.page ?? 0}));

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

  it('search should reset to page 0 and call getOwners with the query', () => {
    component.pageIndex = 2;
    getOwnersSpy.calls.reset();

    component.search('Fr');

    expect(component.pageIndex).toBe(0);
    expect(getOwnersSpy).toHaveBeenCalledWith(jasmine.objectContaining({q: 'Fr', page: 0}));
  });

  it('header click sorts ascending, second click on same header toggles descending', () => {
    component.sortBy('name');

    expect(component.sortField).toBe('name');
    expect(component.sortDir).toBe('asc');
    expect(getOwnersSpy).toHaveBeenCalledWith(jasmine.objectContaining({sort: 'name,asc'}));

    component.sortBy('name');

    expect(component.sortDir).toBe('desc');
    expect(getOwnersSpy).toHaveBeenCalledWith(jasmine.objectContaining({sort: 'name,desc'}));
  });

  it('sorting by a different field resets to ascending and page 0', () => {
    component.sortBy('name');
    component.sortBy('name'); // desc
    component.pageIndex = 1;

    component.sortBy('city');

    expect(component.sortField).toBe('city');
    expect(component.sortDir).toBe('asc');
    expect(component.pageIndex).toBe(0);
  });

  it('Name and City headers are clickable, other headers are not', () => {
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#sortName'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#sortCity'))).toBeTruthy();

    const headers = fixture.debugElement.queryAll(By.css('th'));
    const sortableCount = headers.filter(h => h.nativeElement.classList.contains('sortable')).length;
    expect(sortableCount).toBe(2);
  });

  it('goToPage navigates to the requested server page', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();

    component.goToPage(1);

    expect(component.pageIndex).toBe(1);
    expect(getOwnersSpy).toHaveBeenCalledWith(jasmine.objectContaining({page: 1}));
  });

  it('goToPage ignores out-of-range pages', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();

    component.goToPage(-1);
    component.goToPage(component.totalPages);

    expect(getOwnersSpy).not.toHaveBeenCalled();
  });

  it('changePageSize resets to page 0 and refetches with the new size', () => {
    component.pageIndex = 2;
    getOwnersSpy.calls.reset();

    component.changePageSize(20);

    expect(component.pageSize).toBe(20);
    expect(component.pageIndex).toBe(0);
    expect(getOwnersSpy).toHaveBeenCalledWith(jasmine.objectContaining({size: 20, page: 0}));
  });

});
