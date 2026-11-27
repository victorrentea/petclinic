import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, convertToParamMap, Params, Router} from '@angular/router';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatSortModule} from '@angular/material/sort';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import {map} from 'rxjs/operators';
import {OwnerListComponent} from './owner-list.component';
import {OwnerQuery, OwnerService} from '../owner.service';
import {OwnerPage} from '../owner-page';
import {Owner} from '../owner';

describe('OwnerListComponent', () => {
  const george: Owner = {
    id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  };
  const onePage: OwnerPage = {content: [george], totalElements: 26, totalPages: 3, number: 0, size: 10};

  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let queryParams: BehaviorSubject<Params>;
  let getOwners: jasmine.Spy<(query: OwnerQuery) => Observable<OwnerPage>>;
  let navigate: jasmine.Spy;

  beforeEach(() => {
    queryParams = new BehaviorSubject<Params>({});
    getOwners = jasmine.createSpy('getOwners').and.returnValue(of(onePage));
    navigate = jasmine.createSpy('navigate');
    TestBed.configureTestingModule({
      declarations: [OwnerListComponent],
      imports: [FormsModule, MatPaginatorModule, MatSortModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {provide: OwnerService, useValue: {getOwners}},
        {provide: ActivatedRoute, useValue: {queryParamMap: queryParams.pipe(map(convertToParamMap))}},
        {provide: Router, useValue: {navigate}}
      ]
    });
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
  });

  function lastNavigation(): Params {
    return navigate.calls.mostRecent().args[1].queryParams;
  }

  it('asks for the first 10 owners by name when the URL says nothing', () => {
    fixture.detectChanges();

    expect(getOwners).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('asks for what the URL says', () => {
    queryParams.next({lastName: 'Po', page: '2', size: '20', sort: 'city,desc'});
    fixture.detectChanges();

    expect(getOwners).toHaveBeenCalledWith({lastName: 'Po', page: 2, size: 20, sort: 'city,desc'});
  });

  it('shows the owners of the page, last name first: the sort key leads', () => {
    fixture.detectChanges();

    const name = fixture.debugElement.query(By.css('.ownerFullName')).nativeElement;
    expect(name.innerText).toBe('Franklin, George');
  });

  it('a new search goes back to the first page', () => {
    queryParams.next({page: '3', sort: 'city,asc'});
    fixture.detectChanges();

    component.searchByLastName('Po');

    expect(lastNavigation()).toEqual({lastName: 'Po', page: 0, size: 10, sort: 'city,asc'});
  });

  it('changing the page size goes back to the first page', () => {
    queryParams.next({page: '2'});
    fixture.detectChanges();

    component.onPage({pageIndex: 1, pageSize: 20, length: 26});

    expect(lastNavigation()).toEqual(jasmine.objectContaining({page: 0, size: 20}));
  });

  it('moving to the next page keeps the size', () => {
    fixture.detectChanges();

    component.onPage({pageIndex: 1, pageSize: 10, length: 26});

    expect(lastNavigation()).toEqual(jasmine.objectContaining({page: 1, size: 10}));
  });

  it('a new sort goes back to the first page', () => {
    queryParams.next({page: '2'});
    fixture.detectChanges();

    component.onSort({active: 'city', direction: 'desc'});

    expect(lastNavigation()).toEqual(jasmine.objectContaining({page: 0, sort: 'city,desc'}));
  });

  it('a page past the end moves to the last page, replacing the URL', () => {
    getOwners.and.returnValue(of({content: [], totalElements: 26, totalPages: 3, number: 99, size: 10}));
    queryParams.next({page: '99'});
    fixture.detectChanges();

    expect(lastNavigation()).toEqual(jasmine.objectContaining({page: 2}));
    expect(navigate.calls.mostRecent().args[1].replaceUrl).toBeTrue();
  });

  it('no match shows a message and no pager', () => {
    getOwners.and.returnValue(of({content: [], totalElements: 0, totalPages: 0, number: 0, size: 10}));
    queryParams.next({lastName: 'Zz'});
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No owners with LastName starting with "Zz"');
    expect(fixture.nativeElement.querySelector('mat-paginator')).toBeNull();
  });

  it('only Name and City can be sorted', () => {
    fixture.detectChanges();

    const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
      .map(th => th.nativeElement.textContent.trim());
    expect(sortable).toEqual(['Name', 'City']);
  });

  it('an earlier query answering late is dropped', () => {
    const slow = new Subject<OwnerPage>();
    getOwners.and.returnValues(slow, of(onePage));
    fixture.detectChanges();

    queryParams.next({lastName: 'Franklin'});
    slow.next({...onePage, content: [{...george, id: 2, lastName: 'Davis'}]});

    expect(component.page.content).toEqual([george]);
  });
});
