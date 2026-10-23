/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner} from '../owner';
import {DEFAULT_OWNER_QUERY, OwnerPage, OwnerQuery} from '../owner-page';
import {OwnerListState} from './owner-list-state';
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
  getOwners(query: OwnerQuery): Observable<OwnerPage> {
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
  const davis: Owner = {...testOwner, id: 2, firstName: 'Betty', lastName: 'Davis'};
  const pageOf = (...owners: Owner[]): OwnerPage => ({content: owners, totalElements: owners.length});
  const lastQuery = (): OwnerQuery => getOwnersSpy.calls.mostRecent().args[0];

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
    getOwnersSpy = spyOn(ownerService, 'getOwners').and.returnValue(of(pageOf(testOwner)));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('asks for the first page of 10, sorted by name ascending, on open', () => {
    fixture.detectChanges();

    expect(lastQuery()).toEqual(DEFAULT_OWNER_QUERY);
  });

  it('shows the full name of each owner on the page', () => {
    fixture.detectChanges();

    const cell = fixture.debugElement.query(By.css('#ownersTable td.ownerFullName')).nativeElement;
    expect(cell.innerText).toBe('George Franklin');
  });

  it('lets only Name and City be sorted', () => {
    fixture.detectChanges();

    const sortable = fixture.debugElement.queryAll(By.css('#ownersTable th[mat-sort-header]'))
      .map(th => th.nativeElement.innerText.trim());
    expect(sortable).toEqual(['Name', 'City']);
  });

  it('a new search goes back to the first page and keeps the sort', () => {
    fixture.detectChanges();
    component.onSortChange({active: 'city', direction: 'desc'});
    component.onPage({pageIndex: 3, pageSize: 10, length: 100, previousPageIndex: 2});

    component.searchByLastName('Dav');

    expect(lastQuery()).toEqual({lastName: 'Dav', page: 0, size: 10, sort: 'city', dir: 'desc'});
  });

  it('moving to another page asks the server for that page', () => {
    fixture.detectChanges();

    component.onPage({pageIndex: 1, pageSize: 10, length: 25, previousPageIndex: 0});

    expect(lastQuery()).toEqual({...DEFAULT_OWNER_QUERY, page: 1});
  });

  it('a page size change goes back to the first page', () => {
    fixture.detectChanges();
    component.onPage({pageIndex: 2, pageSize: 10, length: 100, previousPageIndex: 1});

    component.onPage({pageIndex: 1, pageSize: 20, length: 100, previousPageIndex: 2});

    expect(lastQuery()).toEqual({...DEFAULT_OWNER_QUERY, size: 20, page: 0});
  });

  it('a sort change goes back to the first page', () => {
    fixture.detectChanges();
    component.onPage({pageIndex: 2, pageSize: 10, length: 100, previousPageIndex: 1});

    component.onSortChange({active: 'city', direction: 'asc'});

    expect(lastQuery()).toEqual({...DEFAULT_OWNER_QUERY, sort: 'city', dir: 'asc', page: 0});
  });

  it('shows only the latest answer, even when an earlier one arrives after it', () => {
    const firstPage = new Subject<OwnerPage>();
    const secondPage = new Subject<OwnerPage>();
    getOwnersSpy.and.returnValues(firstPage, secondPage);
    fixture.detectChanges();

    component.onPage({pageIndex: 1, pageSize: 10, length: 25, previousPageIndex: 0});
    secondPage.next(pageOf(davis));
    firstPage.next(pageOf(testOwner));

    expect(component.owners).toEqual([davis]);
  });

  it('opens on the page, size and sort found in the URL', () => {
    const route = TestBed.inject(ActivatedRoute) as unknown as ActivatedRouteStub;
    spyOnProperty(route, 'snapshot').and.returnValue(
      {params: {}, queryParams: {page: '2', size: '20', sort: 'city', dir: 'desc', lastName: 'Dav'}} as any);

    fixture.detectChanges();

    expect(lastQuery()).toEqual({lastName: 'Dav', page: 2, size: 20, sort: 'city', dir: 'desc'});
    expect(component.lastName).toBe('Dav');
  });

  it('writes each new query into the URL, replacing the history entry', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    component.onPage({pageIndex: 1, pageSize: 10, length: 25, previousPageIndex: 0});

    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {page: 1, size: 10, sort: 'name', dir: 'asc'},
      replaceUrl: true
    }));
  });

  it('remembers the query it shows, for the way back from an owner', () => {
    fixture.detectChanges();
    expect(TestBed.inject(OwnerListState).lastQuery).toEqual(DEFAULT_OWNER_QUERY);

    component.onSortChange({active: 'city', direction: 'desc'});

    expect(TestBed.inject(OwnerListState).lastQuery).toEqual({...DEFAULT_OWNER_QUERY, sort: 'city', dir: 'desc'});
  });

  it('shows "No owners" when the server finds none', () => {
    getOwnersSpy.and.returnValue(of(pageOf()));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No owners');
    expect(fixture.debugElement.query(By.css('#ownersTable td.ownerFullName'))).toBeNull();
  });

  it('shows "No owners" when the request fails, and the next request still works', () => {
    getOwnersSpy.and.returnValues(throwError(() => 'boom'), of(pageOf(testOwner)));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No owners');

    component.searchByLastName('Fr');
    fixture.detectChanges();

    expect(component.owners).toEqual([testOwner]);
  });
});
