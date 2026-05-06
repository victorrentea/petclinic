/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement, NO_ERRORS_SCHEMA } from '@angular/core';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { Observable, Subject, of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { PartsModule } from '../../parts/parts.module';
import { ActivatedRouteStub } from '../../testing/router-stubs';
import { OwnerDetailComponent } from '../owner-detail/owner-detail.component';
import { OwnersModule } from '../owners.module';
import { DummyComponent } from '../../testing/dummy.component';
import { OwnerAddComponent } from '../owner-add/owner-add.component';
import { OwnerEditComponent } from '../owner-edit/owner-edit.component';
import Spy = jasmine.Spy;


class OwnerServiceStub {
  getOwners(): Observable<Owner[]> {
    return of();
  }

  searchOwners(q: string): Observable<Owner[]> {
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
  let testOwners: Owner[];

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, ReactiveFormsModule, PartsModule, OwnersModule,
        RouterTestingModule.withRoutes(
          [{ path: 'owners', component: OwnerListComponent },
            { path: 'owners/add', component: OwnerAddComponent },
            { path: 'owners/:id', component: OwnerDetailComponent },
            { path: 'owners/:id/edit', component: OwnerEditComponent }
          ])],
      providers: [
        { provide: OwnerService, useValue: ownerService },
        { provide: ActivatedRoute, useClass: ActivatedRouteStub }
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
      .and.returnValue(of(testOwners));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('shows full name after initial getOwners', fakeAsync(() => {
    fixture.detectChanges();
    tick(0); // flush startWith emission through the pipeline
    fixture.detectChanges();
    de = fixture.debugElement.query(By.css('.ownerFullName'));
    el = de.nativeElement;
    expect(el.innerText).toBe(testOwner.firstName + ' ' + testOwner.lastName);
  }));

  it('debounces typing then calls searchOwners with the latest term', fakeAsync(() => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchControl.setValue('F');
    tick(100);
    component.searchControl.setValue('Fr');
    tick(100);
    component.searchControl.setValue('Fra');
    tick(300); // exceed debounce window

    expect(searchOwnersSpy).toHaveBeenCalledTimes(1);
    expect(searchOwnersSpy).toHaveBeenCalledWith('Fra');
  }));

  it('reverts to getOwners when the input is cleared', fakeAsync(() => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    searchOwnersSpy.calls.reset();

    component.searchControl.setValue('Fra');
    tick(300);
    component.searchControl.setValue('');
    tick(300);

    expect(getOwnersSpy).toHaveBeenCalled();
  }));

  it('renders only the latest response (race-safe via switchMap)', fakeAsync(() => {
    fixture.detectChanges();

    const slow = new Subject<Owner[]>();
    const fast = new Subject<Owner[]>();
    searchOwnersSpy.and.returnValues(slow.asObservable(), fast.asObservable());

    component.searchControl.setValue('Fr');
    tick(300);
    component.searchControl.setValue('Fra');
    tick(300);

    // Fast (latest) emits first, slow (stale) emits later — stale must NOT overwrite results.
    fast.next([testOwner]);
    fast.complete();
    slow.next([{ ...testOwner, id: 999, firstName: 'STALE', lastName: 'STALE' }]);
    slow.complete();

    expect(component.owners).toEqual([testOwner]);
  }));

});
