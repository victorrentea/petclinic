/* tslint:disable:no-unused-variable */

import { ComponentFixture, fakeAsync, TestBed, tick, waitForAsync } from '@angular/core/testing';
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
    return of([]);
  }

  searchOwners(query: string): Observable<Owner[]> {
    return of([]);
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
      .and.returnValue(of(testOwners));

  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call searchOwners on init', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);
    expect(searchOwnersSpy.calls.any()).toBe(true, 'searchOwners called on init');
  }));

  it('should show full name after searchOwners resolves', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
    de = fixture.debugElement.query(By.css('.ownerFullName'));
    el = de.nativeElement;
    expect(el.innerText).toBe(testOwner.firstName + ' ' + testOwner.lastName);
  }));

  it('onQueryChange should call searchOwners with the given term', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);
    searchOwnersSpy.calls.reset();

    component.onQueryChange('Fr');
    tick(300);

    expect(searchOwnersSpy).toHaveBeenCalledWith('Fr');
  }));

  it('clearSearch should call searchOwners with empty string', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    // type something first so distinctUntilChanged allows the subsequent clear
    component.onQueryChange('Fr');
    tick(300);
    searchOwnersSpy.calls.reset();

    component.clearSearch();
    tick(300);

    expect(searchOwnersSpy).toHaveBeenCalledWith('');
  }));

  it('should show Add Owner button in the top controls once data is received', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();

    const controlsEl = fixture.debugElement.query(By.css('.owner-controls'));
    expect(controlsEl).toBeTruthy('owner-controls container should exist');

    const addBtn = controlsEl.queryAll(By.css('button'))
      .find(b => b.nativeElement.textContent.trim() === 'Add Owner');
    expect(addBtn).toBeTruthy('Add Owner button should be inside .owner-controls');
  }));

  it('should render exactly one Add Owner button in the entire page', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();

    const allAddBtns = fixture.debugElement.queryAll(By.css('button'))
      .filter(b => b.nativeElement.textContent.trim() === 'Add Owner');
    expect(allAddBtns.length).toBe(1, 'only one Add Owner button should exist');
  }));

});
