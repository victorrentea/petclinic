import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ActivatedRoute, convertToParamMap, Params, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {BehaviorSubject, Observable, of, Subject, throwError} from 'rxjs';
import {map} from 'rxjs/operators';
import {MatPaginator} from '@angular/material/paginator';
import {MatSort} from '@angular/material/sort';

import {OwnerListComponent} from './owner-list.component';
import {OwnerQuery, OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {OwnersModule} from '../owners.module';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  getOwners(query: OwnerQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let getOwnersSpy: Spy;
  let navigateSpy: Spy;
  let queryParams: BehaviorSubject<Params>;

  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  const pageOf = (owners: Owner[], totalElements = owners.length): OwnerPage =>
    ({content: owners, totalElements, totalPages: 1, number: 0, size: 10});

  beforeEach(() => {
    queryParams = new BehaviorSubject<Params>({});
    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useValue: {queryParamMap: queryParams.pipe(map(convertToParamMap))}}
      ]
    });
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    getOwnersSpy = spyOn(TestBed.inject(OwnerService), 'getOwners').and.returnValue(of(pageOf([testOwner])));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  function lastNavigatedQueryParams(): Params {
    return navigateSpy.calls.mostRecent().args[1].queryParams;
  }

  function text(selector: string): string {
    return fixture.nativeElement.querySelector(selector)?.textContent ?? '';
  }

  it('loads the first page sorted by name by default', () => {
    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name'});
    expect(text('.ownerFullName')).toContain('George Franklin');
  });

  it('offers 5, 10 and 20 owners per page', () => {
    fixture.detectChanges();

    const paginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance as MatPaginator;
    expect(paginator.pageSizeOptions).toEqual([5, 10, 20]);
  });

  it('only Name and City headers are sortable', () => {
    fixture.detectChanges();

    const sortableHeaders = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
      .map(header => header.nativeElement.textContent.trim());
    expect(sortableHeaders).toEqual(['Name', 'City']);
  });

  it('state restored from the URL', () => {
    queryParams.next({lastName: 'Fr', page: '3', size: '5', sort: 'city,desc'});
    getOwnersSpy.and.returnValue(of({content: [testOwner], totalElements: 11, totalPages: 3, number: 2, size: 5}));

    fixture.detectChanges();

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: 'Fr', page: 2, size: 5, sort: 'city,desc'});
    expect(component.lastName).toBe('Fr');
    const paginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance as MatPaginator;
    expect(paginator.pageIndex).toBe(2);
    expect(paginator.pageSize).toBe(5);
    expect(paginator.length).toBe(11);
    const sort = fixture.debugElement.query(By.directive(MatSort)).injector.get(MatSort);
    expect(sort.active).toBe('city');
    expect(sort.direction).toBe('desc');
  });

  it('reloads when the URL changes', () => {
    fixture.detectChanges();

    queryParams.next({page: '2', size: '10', sort: 'name'});

    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 1, size: 10, sort: 'name'});
  });

  it('new search starts at page one', () => {
    queryParams.next({lastName: 'Fr', page: '3', size: '5', sort: 'city,asc'});
    fixture.detectChanges();

    component.searchByLastName('Da');

    expect(lastNavigatedQueryParams()).toEqual({lastName: 'Da', page: 1, size: 5, sort: 'city,asc'});
  });

  it('changing the sort starts at page one', () => {
    queryParams.next({page: '3', size: '5', sort: 'name'});
    fixture.detectChanges();

    component.onSort({active: 'city', direction: 'desc'});

    expect(lastNavigatedQueryParams()).toEqual(jasmine.objectContaining({page: 1, size: 5, sort: 'city,desc'}));
  });

  it('changing the page size starts at page one', () => {
    queryParams.next({page: '3', size: '5', sort: 'name'});
    fixture.detectChanges();

    component.onPage({pageIndex: 1, previousPageIndex: 2, pageSize: 10, length: 27});

    expect(lastNavigatedQueryParams()).toEqual(jasmine.objectContaining({page: 1, size: 10}));
  });

  it('moving to another page keeps the search, size and sort', () => {
    queryParams.next({lastName: 'Fr', page: '1', size: '5', sort: 'city,asc'});
    fixture.detectChanges();

    component.onPage({pageIndex: 1, previousPageIndex: 0, pageSize: 5, length: 27});

    expect(lastNavigatedQueryParams()).toEqual({lastName: 'Fr', page: 2, size: 5, sort: 'city,asc'});
  });

  it('no match: shows "no owners found" instead of the table', () => {
    queryParams.next({lastName: 'Zz'});
    getOwnersSpy.and.returnValue(of(pageOf([], 0)));

    fixture.detectChanges();

    expect(text('#noOwnersFound')).toContain('No owners with LastName starting with "Zz"');
    expect(fixture.nativeElement.querySelector('#ownersTable')).toBeNull();
  });

  it('server error: does not show "no owners found"', () => {
    getOwnersSpy.and.returnValue(throwError(() => 'server returned code 500'));

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#noOwnersFound')).toBeNull();
    expect(fixture.nativeElement.querySelector('#ownersTable')).toBeNull();
  });

  it('keeps reloading after a server error', () => {
    getOwnersSpy.and.returnValue(throwError(() => 'server returned code 500'));
    fixture.detectChanges();

    getOwnersSpy.and.returnValue(of(pageOf([testOwner])));
    queryParams.next({lastName: 'Fr'});
    fixture.detectChanges();

    expect(text('.ownerFullName')).toContain('George Franklin');
  });

  it('a late answer to an older query is ignored', () => {
    const initialLoad = new Subject<OwnerPage>();
    getOwnersSpy.and.returnValue(initialLoad);
    fixture.detectChanges();

    getOwnersSpy.and.returnValue(of(pageOf([testOwner])));
    queryParams.next({lastName: 'Franklin'});
    initialLoad.next(pageOf([testOwner, {...testOwner, id: 2, lastName: 'Davis'}]));

    expect(component.ownerPage.content).toEqual([testOwner]);
  });
});
