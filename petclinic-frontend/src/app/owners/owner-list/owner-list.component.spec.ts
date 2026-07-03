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
import { OwnerPage } from '../owner-page';
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
  const testOwnerPage: OwnerPage = {
    content: [testOwner],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 5
  };

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
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testOwnerPage));

  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call ngOnInit() method', () => {
    fixture.detectChanges();
    expect(getOwnersSpy).toHaveBeenCalledWith('', 0, 5, ['lastName,asc', 'firstName,asc', 'id,asc']);
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

  it('searchByLastName should call getOwners for empty term', () => {
    getOwnersSpy.calls.reset();

    component.searchByLastName('');

    expect(getOwnersSpy).toHaveBeenCalledWith('', 0, 5, ['lastName,asc', 'firstName,asc', 'id,asc']);
  });

  it('searchByLastName should call getOwners for non-empty term', () => {
    getOwnersSpy.calls.reset();

    component.searchByLastName('Fr');

    expect(getOwnersSpy).toHaveBeenCalledWith('Fr', 0, 5, ['lastName,asc', 'firstName,asc', 'id,asc']);
  });

  it('onSort should reset to the first page and toggle direction', () => {
    getOwnersSpy.calls.reset();
    component.pageIndex = 2;

    component.onSort('telephone');

    expect(component.pageIndex).toBe(0);
    expect(getOwnersSpy).toHaveBeenCalledWith('', 0, 5, ['telephone,asc']);
  });

  it('onPageSizeChange should reset to the first page', () => {
    getOwnersSpy.calls.reset();
    component.pageIndex = 3;

    component.onPageSizeChange(10);

    expect(component.pageIndex).toBe(0);
    expect(getOwnersSpy).toHaveBeenCalledWith('', 0, 10, ['lastName,asc', 'firstName,asc', 'id,asc']);
  });

  it('renders rows-per-page control in the bottom owners controls bar', () => {
    fixture.detectChanges();

    const controls = fixture.debugElement.query(By.css('.owners-controls'));
    const pageSize = fixture.debugElement.query(By.css('.owners-page-size'));
    const table = fixture.debugElement.query(By.css('#ownersTable table'));

    expect(controls).toBeTruthy();
    expect(pageSize).toBeTruthy();
    expect(table).toBeTruthy();
    expect(table.nativeElement.compareDocumentPosition(controls.nativeElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows arrow sort indicators instead of asc or desc text', () => {
    fixture.detectChanges();
    component.onSort('telephone');
    fixture.detectChanges();

    const sortButton = fixture.debugElement.queryAll(By.css('th .btn-link'))
      .find(button => button.nativeElement.textContent.includes('Telephone'));

    expect(sortButton?.nativeElement.textContent).toContain('↑');
    expect(sortButton?.nativeElement.textContent).not.toContain('asc');
    expect(sortButton?.nativeElement.textContent).not.toContain('desc');
  });

  it('renders add owner on the left and pager with page size on the right in the footer row', () => {
    fixture.detectChanges();

    const controls = fixture.debugElement.query(By.css('.owners-controls'));
    const addOwnerButton = fixture.debugElement.query(By.css('.owners-controls > .btn'));
    const rightControls = fixture.debugElement.query(By.css('.owners-controls .owners-footer-right'));
    const pagination = fixture.debugElement.query(By.css('.owners-controls .owners-pagination'));
    const pageSize = fixture.debugElement.query(By.css('.owners-controls .owners-page-size'));

    expect(controls).toBeTruthy();
    expect(addOwnerButton?.nativeElement.textContent.trim()).toBe('Add Owner');
    expect(rightControls).toBeTruthy();
    expect(pagination).toBeTruthy();
    expect(pageSize).toBeTruthy();
  });

});
