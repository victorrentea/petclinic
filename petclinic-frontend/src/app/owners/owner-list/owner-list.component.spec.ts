import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Observable, of, Subject, throwError} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnerQuery, OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import {OwnersModule} from '../owners.module';
import {ActivatedRouteStub} from '../../testing/router-stubs';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  getOwnersPage(query?: OwnerQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let getOwnersPage: Spy;
  let navigate: Spy;
  let route: ActivatedRouteStub;

  const george: Owner = {
    id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  };
  const aPage = (content: Owner[], totalElements = content.length,
                  totalPages = Math.ceil(totalElements / 10)): OwnerPage =>
    ({content, totalElements, totalPages, number: 0, size: 10});

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, NoopAnimationsModule, OwnersModule, RouterTestingModule],
      providers: [
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    route = TestBed.inject(ActivatedRoute) as unknown as ActivatedRouteStub;
    getOwnersPage = spyOn(TestBed.inject(OwnerService), 'getOwnersPage').and.returnValue(of(aPage([george])));
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  const text = (css: string) => fixture.debugElement.query(By.css(css))?.nativeElement.textContent.trim();
  const navigatedTo = () => navigate.calls.mostRecent().args[1].queryParams;

  it('asks for the first page sorted by name when the URL says nothing', () => {
    fixture.detectChanges();

    expect(getOwnersPage).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('asks for what the URL says, with its 1-based page turned 0-based', () => {
    route.setQueryParams({lastName: 'Pot', page: '3', size: '5', sort: 'city,desc'});
    fixture.detectChanges();

    expect(getOwnersPage).toHaveBeenCalledWith({lastName: 'Pot', page: 2, size: 5, sort: 'city,desc'});
    expect(component.lastName).toBe('Pot');
  });

  it('falls back to the defaults for values the URL gets wrong', () => {
    route.setQueryParams({page: '-2', size: '7', sort: 'telephone,asc'});
    fixture.detectChanges();

    expect(getOwnersPage).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('shows the full name of every owner on the page', () => {
    fixture.detectChanges();

    expect(text('.ownerFullName')).toBe('George Franklin');
  });

  it('a search goes back to the first page, keeping the sort and size', () => {
    route.setQueryParams({page: '3', size: '5', sort: 'city,asc'});
    fixture.detectChanges();

    component.lastName = 'Pot';
    component.search();

    expect(navigatedTo()).toEqual({lastName: 'Pot', size: 5, sort: 'city,asc'});
  });

  it('moving to another page keeps the rest of the query', () => {
    route.setQueryParams({lastName: 'Pot'});
    fixture.detectChanges();

    component.onPage({pageIndex: 2, pageSize: 10, length: 26});

    expect(navigatedTo()).toEqual({lastName: 'Pot', page: 3});
  });

  it('a new page size goes back to the first page', () => {
    route.setQueryParams({page: '3'});
    fixture.detectChanges();

    component.onPage({pageIndex: 1, pageSize: 5, length: 26});

    expect(navigatedTo()).toEqual({size: 5});
  });

  it('a new sort goes back to the first page', () => {
    route.setQueryParams({page: '3'});
    fixture.detectChanges();

    component.sortBy('city');

    expect(navigatedTo()).toEqual({sort: 'city,asc'});
  });

  it('leaves the URL clean when everything is back to its default', () => {
    route.setQueryParams({page: '2', sort: 'city,asc'});
    fixture.detectChanges();

    component.sortBy('name');

    expect(navigatedTo()).toEqual({});
  });

  it('clicking the sorted column flips its direction', () => {
    route.setQueryParams({sort: 'city,asc'});
    fixture.detectChanges();

    component.sortBy('city');

    expect(navigatedTo()).toEqual({sort: 'city,desc'});
  });

  it('only Name and City can be sorted, and the active one says which way', () => {
    route.setQueryParams({sort: 'city,desc'});
    fixture.detectChanges();

    const sortable = fixture.debugElement.queryAll(By.css('th.sortable'));
    expect(sortable.map((th) => th.nativeElement.textContent.trim())).toEqual(['Name', 'City']);
    expect(sortable.map((th) => th.nativeElement.getAttribute('aria-sort'))).toEqual([null, 'descending']);
  });

  it('says no owner matched when the search finds none', () => {
    getOwnersPage.and.returnValue(of(aPage([])));
    route.setQueryParams({lastName: 'Zzzz'});
    fixture.detectChanges();

    expect(text('#noOwners')).toBe('No owners with last name starting with "Zzzz"');
    expect(fixture.debugElement.query(By.css('#ownersTable'))).toBeNull();
  });

  // An owner nobody found is exactly the one about to be added.
  it('still offers Add Owner when the search finds none', () => {
    getOwnersPage.and.returnValue(of(aPage([])));
    route.setQueryParams({lastName: 'Zzzz'});
    fixture.detectChanges();

    expect(text('button[routerLink="/owners/add"]')).toBe('Add Owner');
  });

  it('searching again for the same name asks again, though the URL does not change', () => {
    route.setQueryParams({lastName: 'Pot'});
    fixture.detectChanges();
    getOwnersPage.calls.reset();

    component.lastName = 'Pot';
    component.search();

    expect(navigate).not.toHaveBeenCalled();
    expect(getOwnersPage).toHaveBeenCalledWith({lastName: 'Pot', page: 0, size: 10, sort: 'name,asc'});
  });

  it('shows a failure as an error, not as "no owners"', () => {
    getOwnersPage.and.returnValue(throwError('server returned code 500'));
    fixture.detectChanges();

    expect(text('#ownersError')).toContain('server returned code 500');
    expect(fixture.debugElement.query(By.css('#noOwners'))).toBeNull();
  });

  it('moves to the last page when the URL points past it', () => {
    getOwnersPage.and.returnValue(of(aPage([], 26, 3)));
    route.setQueryParams({page: '9'});
    fixture.detectChanges();

    expect(navigatedTo()).toEqual({page: 3});
    expect(navigate.calls.mostRecent().args[1].replaceUrl).toBe(true);
  });

  // A page asked for earlier must not overwrite the one asked for since, when it answers late.
  it('only the latest query may answer', () => {
    const slowAnswer = new Subject<OwnerPage>();
    getOwnersPage.and.returnValue(slowAnswer);
    fixture.detectChanges();

    getOwnersPage.and.returnValue(of(aPage([george])));
    route.setQueryParams({lastName: 'Franklin'});
    slowAnswer.next(aPage([{...george, id: 2, lastName: 'Davis'}]));

    expect(component.page?.content).toEqual([george]);
  });
});
