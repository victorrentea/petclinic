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


class OwnerServiceStub {
  getOwnersPage(options: { lastName?: string; page?: number; size?: number; sort?: string }): Observable<OwnerPage> {
    return of({ content: [], page: { size: 10, number: 0, totalElements: 0, totalPages: 0 } });
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersPageSpy: Spy;
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

  const testPage: OwnerPage = {
    content: [testOwner],
    page: { size: 10, number: 0, totalElements: 1, totalPages: 1 }
  };

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
    getOwnersPageSpy = spyOn(ownerService, 'getOwnersPage')
      .and.returnValue(of(testPage));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should load the first page on ngOnInit()', () => {
    fixture.detectChanges();
    expect(getOwnersPageSpy.calls.any()).toBe(true, 'getOwnersPage called');
    expect(component.owners).toEqual([testOwner]);
    expect(component.totalElements).toBe(1);
  });

  it('shows the name surname-first (Lastname, Firstname)', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText.trim()).toBe('Franklin, George');
    });
  }));

  it('searchByLastName resets to page 0 and keeps sort + size', () => {
    component.pageIndex = 3;
    component.pageSize = 20;
    component.sortParam = 'city,desc';
    getOwnersPageSpy.calls.reset();

    component.searchByLastName('Fr');

    expect(component.pageIndex).toBe(0);
    expect(getOwnersPageSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ lastName: 'Fr', page: 0, size: 20, sort: 'city,desc' }));
  });

  it('onSortChange re-fetches from page 0 with the new sort', () => {
    component.pageIndex = 2;
    getOwnersPageSpy.calls.reset();

    component.onSortChange({ active: 'city', direction: 'desc' });

    expect(component.pageIndex).toBe(0);
    expect(getOwnersPageSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ sort: 'city,desc', page: 0 }));
  });

  it('onPageChange re-fetches the requested page and size', () => {
    getOwnersPageSpy.calls.reset();

    component.onPageChange({ pageIndex: 2, pageSize: 20, length: 100 });

    expect(getOwnersPageSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 2, size: 20 }));
  });

});
