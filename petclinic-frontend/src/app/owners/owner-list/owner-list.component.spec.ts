/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
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

const testOwner: Owner = {
  id: 1,
  firstName: 'George',
  lastName: 'Franklin',
  address: '110 W. Liberty St.',
  city: 'Madison',
  telephone: '6085551023',
  pets: []
};

const testOwnerPage: OwnerPage = {
  content: [testOwner],
  totalElements: 1,
  totalPages: 1,
  number: 0,
  size: 20
};

class OwnerServiceStub {
  getOwners(page = 0, size = 20, sort?: string[]): Observable<OwnerPage> {
    return of(testOwnerPage);
  }

  searchOwners(lastName: string, page = 0, size = 20, sort?: string[]): Observable<OwnerPage> {
    return of(testOwnerPage);
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
    getOwnersSpy = spyOn(ownerService, 'getOwners').and.returnValue(of(testOwnerPage));
    searchOwnersSpy = spyOn(ownerService, 'searchOwners').and.returnValue(of(testOwnerPage));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call getOwners with page=0, size=20, no sort on init', () => {
    fixture.detectChanges();
    expect(getOwnersSpy).toHaveBeenCalledWith(0, 20, undefined);
  });

  it('should call ngOnInit() method', () => {
    fixture.detectChanges();
    expect(getOwnersSpy.calls.any()).toBe(true, 'getOwners called');
  });

  it('should show full name after getOwners observable (async)', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText).toBe((testOwner.firstName.toString() + ' ' + testOwner.lastName.toString()));
    });
  }));

  it('searchByLastName should call getOwners for empty term', () => {
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchByLastName('');

    expect(getOwnersSpy).toHaveBeenCalled();
    expect(searchOwnersSpy).not.toHaveBeenCalled();
  });

  it('searchByLastName should call searchOwners for non-empty term', () => {
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchByLastName('Fr');

    expect(searchOwnersSpy).toHaveBeenCalledWith('Fr', 0, 20, undefined);
    expect(getOwnersSpy).not.toHaveBeenCalled();
  });

  it('onSortChange by Name column sends compound lastName+firstName sort', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();

    component.onSortChange({active: 'lastName', direction: 'asc'});

    expect(getOwnersSpy).toHaveBeenCalledWith(0, 20, ['firstName,asc', 'lastName,asc']);
  });

  it('searchByLastName should reset pageIndex to 0', () => {
    component.pageIndex = 2;
    component.searchByLastName('Fr');
    expect(component.pageIndex).toBe(0);
  });

});
