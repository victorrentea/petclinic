/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {Observable, of, Subject} from 'rxjs';
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
  getOwners(page: number, size: number, sort: string, lastName?: string): Observable<OwnerPage> {
    return of();
  }
}

function pageOf(owners: Owner[], overrides: Partial<OwnerPage> = {}): OwnerPage {
  return {
    content: owners,
    totalElements: owners.length,
    totalPages: 1,
    number: 0,
    size: 10,
    ...overrides
  };
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
    pets: [{id: 1, name: 'Milton'} as any]
  };
  const testOwner2: Owner = {
    id: 2,
    firstName: 'Betty',
    lastName: 'Davis',
    address: '638 Cardinal Ave.',
    city: 'Sun Prairie',
    telephone: '6085551749',
    pets: []
  };
  let testOwners: Owner[];

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
    testOwners = [testOwner, testOwner2];

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(pageOf(testOwners)));

  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call getOwners with default page/size/sort on init', () => {
    fixture.detectChanges();
    expect(getOwnersSpy).toHaveBeenCalledWith(0, 10, 'name,asc', undefined);
  });

  it('should render a page of owners in #ownersTable td.ownerFullName as "LastName, FirstName"', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const table = fixture.debugElement.query(By.css('#ownersTable'));
      expect(table).toBeTruthy();

      const nameCells = fixture.debugElement.queryAll(By.css('#ownersTable td.ownerFullName'));
      expect(nameCells.length).toBe(2);
      expect((nameCells[0].nativeElement as HTMLElement).innerText.trim())
        .toBe(`${testOwner.lastName}, ${testOwner.firstName}`);
    });
  }));

  it('should render exactly one <tr> per owner row (Pets cell markup fixed)', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const dataRows = fixture.debugElement.queryAll(By.css('#ownersTable tr.mat-mdc-row, #ownersTable tr.mat-row'));
      expect(dataRows.length).toBe(testOwners.length);
    });
  }));

  it('clicking the Name column header issues a request with sort=name', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      getOwnersSpy.calls.reset();

      const sortHeaders = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'));
      expect(sortHeaders.length).toBe(2); // Name, City only

      sortHeaders[0].nativeElement.click();
      fixture.detectChanges();

      expect(getOwnersSpy).toHaveBeenCalled();
      const [, , sortArg] = getOwnersSpy.calls.mostRecent().args;
      expect(sortArg).toMatch(/^name,/);
    });
  }));

  it('Address, Telephone and Pets headers are not sortable', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const headers = fixture.debugElement.queryAll(By.css('#ownersTable th'));
      const headerTexts = headers.map(h => (h.nativeElement as HTMLElement).innerText.trim());
      expect(headerTexts).toEqual(['Name', 'Address', 'City', 'Telephone', 'Pets']);

      const sortableHeaders = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
        .map(h => (h.nativeElement as HTMLElement).innerText.trim());
      expect(sortableHeaders).toEqual(['Name', 'City']);
    });
  }));

  it('paginator offers page sizes 5, 10, 20 with default 10', () => {
    fixture.detectChanges();
    expect(component.pageSizeOptions).toEqual([5, 10, 20]);
    expect(component.pageSize).toBe(10);
  });

  it('changing page size issues a request with that size and page=0', () => {
    fixture.detectChanges();
    getOwnersSpy.calls.reset();

    component.onPageChange({pageIndex: 0, pageSize: 20, length: 2} as any);

    expect(getOwnersSpy).toHaveBeenCalledWith(0, 20, 'name,asc', undefined);
  });

  it('searchByLastName resets to page 0 while keeping the current sort', () => {
    fixture.detectChanges();
    component.onSortChange({active: 'city', direction: 'desc'} as any);
    component.pageIndex = 3;
    getOwnersSpy.calls.reset();

    component.searchByLastName('Fr');

    expect(getOwnersSpy).toHaveBeenCalledWith(0, 10, 'city,desc', 'Fr');
  });

  it('discards a stale response that resolves after a newer request was issued', () => {
    fixture.detectChanges();

    const staleResponse = new Subject<OwnerPage>();
    const freshResponse = new Subject<OwnerPage>();
    getOwnersSpy.and.returnValues(staleResponse.asObservable(), freshResponse.asObservable());

    component.onSortChange({active: 'city', direction: 'asc'} as any);
    component.onPageChange({pageIndex: 1, pageSize: 10, length: 40} as any);

    freshResponse.next(pageOf([testOwner2], {number: 1}));
    staleResponse.next(pageOf([testOwner], {number: 0}));

    expect(component.owners).toEqual([testOwner2]);
  });

});
