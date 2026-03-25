/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {Observable, of, Subject, throwError} from 'rxjs';
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
  getOwnersPaged(page: number, size: number, lastName?: string): Observable<OwnerPage> {
    return of({ owners: [], totalElements: 0, totalPages: 0, currentPage: 0 });
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: OwnerServiceStub;
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
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    testOwners = [testOwner];

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService) as unknown as OwnerServiceStub;
    getOwnersSpy = spyOn(ownerService, 'getOwnersPaged')
      .and.returnValue(of({ owners: testOwners, totalElements: 1, totalPages: 1, currentPage: 0 }));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call ngOnInit() method', () => {
    fixture.detectChanges();
    expect(getOwnersSpy.calls.any()).toBe(true, 'getOwnersPaged called');
  });

  it('should show full name after getOwnersPaged observable (async)', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText).toBe((testOwner.firstName.toString() + ' ' + testOwner.lastName.toString()));
    });
  }));

  it('onSearchBlur should call getOwnersPaged with current lastName', () => {
    getOwnersSpy.calls.reset();
    component.lastName = 'Fra';

    component.onSearchBlur();

    expect(getOwnersSpy).toHaveBeenCalledWith(0, component.pageSize, 'Fra');
  });

  it('onSearchInput should debounce and call getOwnersPaged after 500ms', fakeAsync(() => {
    getOwnersSpy.calls.reset();
    component.ngOnInit();
    component.lastName = 'Fr';

    component.onSearchInput();
    tick(499);
    expect(getOwnersSpy).not.toHaveBeenCalledWith(0, component.pageSize, 'Fr');

    tick(1);
    expect(getOwnersSpy).toHaveBeenCalledWith(0, component.pageSize, 'Fr');
    component.ngOnDestroy();
  }));

  // 11.1 — page navigation updates currentPage
  it('page navigation updates currentPage', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    getOwnersSpy.and.returnValue(of({ owners: testOwners, totalElements: 1, totalPages: 3, currentPage: 2 }));

    component.onPageChange(2);

    // loadPage passes `lastName || undefined`, so empty string becomes undefined
    expect(getOwnersSpy).toHaveBeenCalledWith(2, component.pageSize, undefined);
  });

  // 11.1 — search input resets currentPage to 0
  it('search input resets currentPage to 0', () => {
    fixture.detectChanges();
    component.currentPage = 3;
    getOwnersSpy.calls.reset();

    component.onSearchBlur();

    // loadPage passes `lastName || undefined`, so empty string becomes undefined
    expect(getOwnersSpy).toHaveBeenCalledWith(0, component.pageSize, undefined);
  });

  // 11.1 — error state shows banner and restores previous owners
  it('error state shows banner and restores previous owners', () => {
    const previousOwners: Owner[] = [testOwner];
    component.owners = previousOwners;
    component.previousOwners = previousOwners;
    getOwnersSpy.and.returnValue(throwError('err'));

    component.loadPage(0, 10, '');

    expect(component.errorMessage).toBe('Failed to load owners. Please try again.');
    expect(component.owners).toBe(previousOwners);
  });

  // 11.1 — loading = true during request, false after
  it('loading is true during request and false after completion', fakeAsync(() => {
    const subject = new Subject<OwnerPage>();
    getOwnersSpy.and.returnValue(subject.asObservable());

    component.loadPage(0, 10, '');
    expect(component.loading).toBe(true);

    subject.next({ owners: testOwners, totalElements: 1, totalPages: 1, currentPage: 0 });
    subject.complete();
    expect(component.loading).toBe(false);
  }));

});
