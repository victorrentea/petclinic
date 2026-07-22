/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
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
  getOwners(query: any): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersSpy: Spy;
  let route: ActivatedRouteStub;
  let router: Router;
  let navigateSpy: Spy;
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
  let testPage: OwnerPage;

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
    testPage = {
      content: [testOwner],
      totalElements: 28,
      totalPages: 3,
      number: 0,
      size: 10
    };

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    route = TestBed.inject(ActivatedRoute) as unknown as ActivatedRouteStub;
    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate');
    getOwnersSpy = spyOn(ownerService, 'getOwners')
      .and.returnValue(of(testPage));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  // ---------- 7.2 sort/page events call the service with the right params ----------

  it('should request the first page sorted by name on init', () => {
    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({page: 0, size: 10, sort: 'name,asc', lastName: ''}));
  });

  it('should expose the totals from the page envelope', () => {
    fixture.detectChanges();

    expect(component.totalElements).toBe(28);
    expect(component.owners).toEqual([testOwner]);
  });

  it('should request the page described by the URL, not a hardcoded first page', () => {
    route.setQueryParams({page: '2', size: '20', sort: 'city,desc', lastName: 'Da'});
    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({page: 2, size: 20, sort: 'city,desc', lastName: 'Da'}));
  });

  // ---------- 7.3 URL sync ----------

  it('should navigate with merged params when sorting', () => {
    fixture.detectChanges();

    component.onSortChange({active: 'city', direction: 'asc'} as any);

    expect(navigateSpy).toHaveBeenCalled();
    const extras = navigateSpy.calls.mostRecent().args[1];
    expect(extras.queryParams).toEqual(jasmine.objectContaining({sort: 'city,asc'}));
    expect(extras.queryParamsHandling).toBe('merge');
  });

  it('should navigate with merged params when paging', () => {
    fixture.detectChanges();

    component.onPageChange({pageIndex: 3, pageSize: 20} as any);

    const extras = navigateSpy.calls.mostRecent().args[1];
    expect(extras.queryParams).toEqual(jasmine.objectContaining({page: 3, size: 20}));
    expect(extras.queryParamsHandling).toBe('merge');
  });

  it('should reset to the first page when the filter changes', () => {
    route.setQueryParams({page: '3', size: '10', sort: 'name,asc', lastName: ''});
    fixture.detectChanges();

    component.searchByLastName('Dav');

    const extras = navigateSpy.calls.mostRecent().args[1];
    expect(extras.queryParams).toEqual(jasmine.objectContaining({lastName: 'Dav', page: 0}));
  });

  it('should keep the filter applied when sorting', () => {
    route.setQueryParams({page: '0', size: '10', sort: 'name,asc', lastName: 'Dav'});
    fixture.detectChanges();

    component.onSortChange({active: 'city', direction: 'desc'} as any);

    // 'merge' is what preserves lastName in the URL, so the filter survives a re-sort
    const extras = navigateSpy.calls.mostRecent().args[1];
    expect(extras.queryParamsHandling).toBe('merge');
    expect(extras.queryParams.lastName).toBeUndefined();
  });

  // ---------- 7.4 name rendering ----------

  it('should render the Name cell as "Last, First"', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText.trim()).toBe('Franklin, George');
    });
  }));

  it('should only offer sorting on Name and City', () => {
    fixture.detectChanges();

    const sortableHeaders = fixture.debugElement
      .queryAll(By.css('th[mat-sort-header]'))
      .map((header) => header.attributes['mat-sort-header']);

    expect(sortableHeaders.sort()).toEqual(['city', 'name']);
  });
});
