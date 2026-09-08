/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import { OwnerService } from '../owner.service';
import {OwnerListItem} from '../owner';
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
  getOwners(page?: number, size?: number, sort?: string): Observable<OwnerPage> {
    return of();
  }

  searchOwners(lastName: string, page?: number, size?: number, sort?: string): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let searchOwnersSpy: Spy;
  let activatedRoute: ActivatedRouteStub;
  let de: DebugElement;
  let el: HTMLElement;


  const testOwner: OwnerListItem = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    petNames: []
  };
  let testOwnerPage: OwnerPage;

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
    testOwnerPage = {content: [testOwner], totalElements: 1, totalPages: 1, number: 0, size: 10};

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    activatedRoute = fixture.debugElement.injector.get(ActivatedRoute) as any;
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testOwnerPage));
    searchOwnersSpy = spyOn(ownerService, 'searchOwners')
      .and.returnValue(of(testOwnerPage));

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
      expect(el.innerText).toBe((testOwner.lastName.toString() + ' ' + testOwner.firstName.toString()));
    });
  }));

  it('searchByLastName should call searchOwners with the given term', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchByLastName('Fr');

    expect(searchOwnersSpy).toHaveBeenCalledWith('Fr', 0, 10, 'lastName,asc');
  });

  it('searchByLastName should call getOwners for empty term', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchByLastName('');

    expect(getOwnersSpy).toHaveBeenCalled();
    expect(searchOwnersSpy).not.toHaveBeenCalled();
  });

  it('sortBy should toggle direction when clicking the active column twice', () => {
    fixture.detectChanges();

    component.sortBy('lastName'); // already lastName,asc by default -> becomes desc
    expect(component.sortDirection).toBe('desc');
    expect(getOwnersSpy).toHaveBeenCalledWith(0, 10, 'lastName,desc');

    component.sortBy('lastName');
    expect(component.sortDirection).toBe('asc');
    expect(getOwnersSpy).toHaveBeenCalledWith(0, 10, 'lastName,asc');
  });

  it('sortBy should switch to the new column ascending when clicking a different column', () => {
    fixture.detectChanges();

    component.sortBy('city');

    expect(component.sortProperty).toBe('city');
    expect(component.sortDirection).toBe('asc');
    expect(getOwnersSpy).toHaveBeenCalledWith(0, 10, 'city,asc');
  });

});

