/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
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
  getOwners(): Observable<Owner[]> {
    return of();
  }

  searchOwners(searchText: string): Observable<Owner[]> {
    return of();
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


  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  const secondTestOwner: Owner = {
    id: 2,
    firstName: 'Betty',
    lastName: 'Davis',
    address: '22 Main st',
    city: 'Seattle',
    telephone: '1234567890',
    pets: [{ id: 3, name: 'Milo', birthDate: '2024-01-01', type: { id: 1, name: 'cat' }, ownerId: 2, owner: null as unknown as Owner, visits: [] }]
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
      .and.returnValue(of(testOwners));
    searchOwnersSpy = spyOn(ownerService, 'searchOwners')
      .and.returnValue(of([]));

  });

  function loadComponentWithOwners(owners: Owner[]) {
    getOwnersSpy.and.returnValue(of(owners));
    fixture.detectChanges();
  }

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

  it('calls backend search for non-empty text', () => {
    loadComponentWithOwners([testOwner, secondTestOwner]);
    searchOwnersSpy.and.returnValue(of([secondTestOwner]));

    component.onSearchTermChange('Main');

    expect(searchOwnersSpy).toHaveBeenCalledWith('Main');
    expect(component.owners).toEqual([secondTestOwner]);
  });

  it('searches on each text change', () => {
    loadComponentWithOwners([testOwner, secondTestOwner]);
    searchOwnersSpy.and.returnValue(of([secondTestOwner]));

    component.onSearchTermChange('Mai');
    component.onSearchTermChange('Main');

    expect(searchOwnersSpy).toHaveBeenCalledTimes(2);
    expect(searchOwnersSpy).toHaveBeenCalledWith('Mai');
    expect(searchOwnersSpy).toHaveBeenCalledWith('Main');
  });

  it('restores all owners when search text is empty', () => {
    loadComponentWithOwners([testOwner, secondTestOwner]);
    searchOwnersSpy.and.returnValue(of([secondTestOwner]));

    component.onSearchTermChange('Main');
    getOwnersSpy.calls.reset();
    component.onSearchTermChange('');

    expect(getOwnersSpy).toHaveBeenCalled();
    expect(component.owners).toEqual([testOwner, secondTestOwner]);
  });

  it('does not call backend search for empty text', () => {
    loadComponentWithOwners([testOwner, secondTestOwner]);
    searchOwnersSpy.calls.reset();

    component.onSearchTermChange('');

    expect(searchOwnersSpy).not.toHaveBeenCalled();
  });

});
