import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, convertToParamMap, Params, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatPaginator} from '@angular/material/paginator';
import {BehaviorSubject, Observable, of, Subject, throwError} from 'rxjs';
import {map} from 'rxjs/operators';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {OwnersModule} from '../owners.module';
import {PartsModule} from '../../parts/parts.module';
import Spy = jasmine.Spy;

const george: Owner = {
  id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
  city: 'Madison', telephone: '6085551023', pets: []
};

function pageOf(owners: Owner[], over: Partial<OwnerPage> = {}): OwnerPage {
  return {content: owners, totalElements: owners.length, totalPages: 1, number: 0, size: 10, ...over};
}

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let queryParams$: BehaviorSubject<Params>;
  let getOwners: Spy;
  let navigate: Spy;

  function openWith(params: Params, answer: Observable<OwnerPage> = of(pageOf([george]))) {
    queryParams$.next(params);
    getOwners.and.returnValue(answer);
    fixture.detectChanges();
  }

  beforeEach(waitForAsync(() => {
    queryParams$ = new BehaviorSubject<Params>({});
    const route = {queryParamMap: queryParams$.pipe(map(params => convertToParamMap(params)))};
    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [FormsModule, PartsModule, OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        {provide: OwnerService, useValue: {getOwners: () => of()}},
        {provide: ActivatedRoute, useValue: route}
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    getOwners = spyOn(TestBed.inject(OwnerService), 'getOwners');
    navigate = spyOn(TestBed.inject(Router), 'navigate');
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
  });

  it('opens on the first page of 10, sorted by name ascending', () => {
    openWith({});

    expect(getOwners).toHaveBeenCalledWith({page: 0, size: 10, sort: 'name,asc', lastName: ''});
  });

  it('shows the owner name', () => {
    openWith({});

    const name = fixture.debugElement.query(By.css('.ownerFullName')).nativeElement;
    expect(name.innerText).toBe('George Franklin');
  });

  it('restores page, size, sort and last name from the URL', () => {
    openWith({page: '2', size: '5', sort: 'city,desc', lastName: 'Fr'},
      of(pageOf([george], {number: 2, totalPages: 3, totalElements: 11})));

    expect(getOwners).toHaveBeenCalledWith({page: 2, size: 5, sort: 'city,desc', lastName: 'Fr'});
    expect(component.pageIndex).toBe(2);
    expect(component.size).toBe(5);
    expect(component.sortKey).toBe('city');
    expect(component.sortDirection).toBe('desc');
    expect(component.lastName).toBe('Fr');
  });

  it('ignores nonsense in the URL', () => {
    openWith({page: '-3', size: '7', sort: 'telephone,asc'});

    expect(getOwners).toHaveBeenCalledWith({page: 0, size: 10, sort: 'name,asc', lastName: ''});
  });

  it('shows the total and offers 5, 10 and 20 rows per page', () => {
    openWith({}, of(pageOf([george], {totalElements: 12, totalPages: 2})));

    const paginator: MatPaginator = fixture.debugElement.query(By.directive(MatPaginator)).componentInstance;
    expect(paginator.length).toBe(12);
    expect(paginator.pageSizeOptions).toEqual([5, 10, 20]);
  });

  it('lets only Name and City be sorted', () => {
    openWith({});

    const sortable = fixture.debugElement.queryAll(By.css('th.mat-sort-header'));
    expect(sortable.map(th => th.nativeElement.textContent.trim())).toEqual(['Name', 'City']);
  });

  it('sorting goes to the first page', () => {
    openWith({page: '3'});

    component.onSort({active: 'city', direction: 'desc'});

    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {sort: 'city,desc', page: 0}, queryParamsHandling: 'merge'}));
  });

  it('changing the page size goes to the first page', () => {
    openWith({page: '3'});

    component.onPage({pageIndex: 3, pageSize: 20, length: 100});

    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {size: 20, page: 0}}));
  });

  it('moving between pages keeps everything else', () => {
    openWith({});

    component.onPage({pageIndex: 1, pageSize: 10, length: 100});

    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {page: 1}, queryParamsHandling: 'merge'}));
  });

  it('a new search starts from the first page', () => {
    openWith({page: '3'});

    component.searchByLastName('Fr');

    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {lastName: 'Fr', page: 0}}));
  });

  it('an empty search drops the last name from the URL', () => {
    openWith({lastName: 'Fr'});

    component.searchByLastName('');

    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {lastName: null, page: 0}}));
  });

  it('a page past the last one redirects to the last page, replacing the URL', () => {
    openWith({page: '7', size: '5'}, of(pageOf([], {number: 7, totalPages: 3, totalElements: 12})));

    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {page: 2}, replaceUrl: true}));
    expect(component.owners).toEqual([]);
  });

  it('a failed request shows no owners and the next query still loads', () => {
    openWith({}, throwError('boom'));
    expect(component.owners).toEqual([]);

    getOwners.and.returnValue(of(pageOf([george])));
    queryParams$.next({lastName: 'Fr'});

    expect(component.owners).toEqual([george]);
  });

  it('an answer arriving late does not erase what is being typed in the search box', () => {
    const answer = new Subject<OwnerPage>();
    openWith({}, answer);

    component.lastName = 'Fra';
    answer.next(pageOf([george]));

    expect(component.lastName).toBe('Fra');
  });

  it('a late answer to an older query does not overwrite the latest one', () => {
    const first = new Subject<OwnerPage>();
    const second = new Subject<OwnerPage>();
    openWith({}, first);

    getOwners.and.returnValue(second);
    queryParams$.next({lastName: 'Franklin'});
    second.next(pageOf([george]));
    first.next(pageOf([george, {...george, id: 2, lastName: 'Davis'}]));

    expect(component.owners).toEqual([george]);
  });
});
