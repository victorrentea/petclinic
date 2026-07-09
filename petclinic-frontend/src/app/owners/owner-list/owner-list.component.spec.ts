/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { OwnerListComponent } from './owner-list.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { OwnerPage } from '../owner-page';
import { Observable, of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { CommonModule } from '@angular/common';
import { PartsModule } from '../../parts/parts.module';
import { ActivatedRouteStub } from '../../testing/router-stubs';
import { OwnerDetailComponent } from '../owner-detail/owner-detail.component';
import { OwnersModule } from '../owners.module';
import { DummyComponent } from '../../testing/dummy.component';
import { OwnerAddComponent } from '../owner-add/owner-add.component';
import { OwnerEditComponent } from '../owner-edit/owner-edit.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
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
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 10,
  };

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule, BrowserAnimationsModule,
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
    getOwnersSpy = spyOn(ownerService, 'getOwners').and.returnValue(of(testPage));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit loads the first page with default params', () => {
    fixture.detectChanges();
    expect(getOwnersSpy).toHaveBeenCalled();
    expect(getOwnersSpy.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ page: 0, size: 10, sort: 'name', dir: 'asc' }));
    expect(component.owners).toEqual([testOwner]);
    expect(component.totalElements).toBe(1);
  });

  it('renders the Name column as "Last, First"', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const de = fixture.debugElement.query(By.css('.ownerFullName'));
      expect(de.nativeElement.textContent.trim()).toContain('Franklin, George');
    });
  }));

  it('search() resets to the first page and filters by last name', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    component.pageIndex = 3;
    component.lastName = 'Fr';

    component.search();

    expect(component.pageIndex).toBe(0);
    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 0, lastName: 'Fr' }));
  });

  it('onSort() sets sort/dir and resets to the first page', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();
    component.pageIndex = 2;

    component.onSort({ active: 'city', direction: 'desc' });

    expect(component.sort).toBe('city');
    expect(component.dir).toBe('desc');
    expect(component.pageIndex).toBe(0);
    expect(getOwnersSpy).toHaveBeenCalled();
  });

  it('onSort() with no direction falls back to name asc', () => {
    fixture.detectChanges();
    component.onSort({ active: 'city', direction: '' });
    expect(component.sort).toBe('name');
    expect(component.dir).toBe('asc');
  });

  it('onPage() updates page index and size', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();

    component.onPage({ pageIndex: 2, pageSize: 20, length: 100 });

    expect(component.pageIndex).toBe(2);
    expect(component.pageSize).toBe(20);
    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 2, size: 20 }));
  });

});
