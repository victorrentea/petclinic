import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, convertToParamMap, Params, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatSortModule} from '@angular/material/sort';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import {map} from 'rxjs/operators';

import {OwnerListComponent} from './owner-list.component';
import {OwnerQuery, OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage} from '../owner-page';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  getOwnerPage(query: OwnerQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let getOwnerPageSpy: Spy;
  let navigateSpy: Spy;
  let queryParams: BehaviorSubject<Params>;

  const george: Owner = {
    id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  };
  const pageOf = (owners: Owner[], totalElements = owners.length, number = 0, size = 10): OwnerPage =>
    ({content: owners, totalElements, totalPages: Math.ceil(totalElements / size), number, size});

  beforeEach(() => {
    queryParams = new BehaviorSubject<Params>({});
    TestBed.configureTestingModule({
      declarations: [OwnerListComponent],
      imports: [FormsModule, RouterTestingModule, MatPaginatorModule, MatSortModule, NoopAnimationsModule],
      providers: [
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useValue: {queryParamMap: queryParams.pipe(map(convertToParamMap))}}
      ]
    });
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    getOwnerPageSpy = spyOn(TestBed.inject(OwnerService), 'getOwnerPage').and.returnValue(of(pageOf([george])));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  const lastNavigation = () => navigateSpy.calls.mostRecent().args[1];

  it('asks for the first 10 owners by name when the URL says nothing', () => {
    fixture.detectChanges();

    expect(getOwnerPageSpy).toHaveBeenCalledWith({lastName: '', page: 1, size: 10, sort: 'name,asc'});
  });

  it('asks for exactly what the URL names', () => {
    queryParams.next({lastName: 'Pot', page: '2', size: '5', sort: 'city,desc'});
    fixture.detectChanges();

    expect(getOwnerPageSpy).toHaveBeenCalledWith({lastName: 'Pot', page: 2, size: 5, sort: 'city,desc'});
  });

  it('falls back to the defaults for values the grid does not offer', () => {
    queryParams.next({page: '-3', size: '50000', sort: 'telephone,asc'});
    fixture.detectChanges();

    expect(getOwnerPageSpy).toHaveBeenCalledWith({lastName: '', page: 1, size: 10, sort: 'name,asc'});
  });

  it('shows the owners full names', () => {
    fixture.detectChanges();

    const name = fixture.debugElement.query(By.css('.ownerFullName')).nativeElement as HTMLElement;
    expect(name.innerText).toBe('George Franklin');
  });

  it('a search starts again at page 1', () => {
    queryParams.next({page: '3'});
    fixture.detectChanges();

    component.searchByLastName('Pot');

    expect(lastNavigation().queryParams).toEqual({lastName: 'Pot', page: null});
    expect(lastNavigation().queryParamsHandling).toBe('merge');
  });

  it('an empty search drops the last name from the URL', () => {
    component.searchByLastName('');

    expect(lastNavigation().queryParams).toEqual({lastName: null, page: null});
  });

  it('only Name and City headers sort', () => {
    fixture.detectChanges();

    const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
      .map(th => (th.nativeElement as HTMLElement).textContent.trim());
    expect(sortable).toEqual(['Name', 'City']);
  });

  it('clicking City twice sorts by city descending, from page 1', () => {
    fixture.detectChanges();
    const city = fixture.debugElement.query(By.css('th[mat-sort-header="city"]')).nativeElement as HTMLElement;

    city.click();
    queryParams.next({sort: 'city,asc'});
    fixture.detectChanges();
    city.click();

    expect(lastNavigation().queryParams).toEqual({sort: 'city,desc', page: null});
  });

  it('moving to the next page keeps everything else', () => {
    fixture.detectChanges();

    component.changePage({pageIndex: 1, pageSize: 10, length: 27});

    expect(lastNavigation().queryParams).toEqual({page: 2});
  });

  it('changing rows per page starts again at page 1', () => {
    fixture.detectChanges();

    component.changePage({pageIndex: 0, pageSize: 20, length: 27});

    expect(lastNavigation().queryParams).toEqual({size: 20, page: null});
  });

  it('a page past the end lands on the last page, replacing the URL', () => {
    getOwnerPageSpy.and.returnValue(of(pageOf([], 27, 98)));
    queryParams.next({page: '99'});
    fixture.detectChanges();

    expect(lastNavigation().queryParams).toEqual({page: 3});
    expect(lastNavigation().replaceUrl).toBe(true);
  });

  it('no matching owners shows the message and no paginator', () => {
    getOwnerPageSpy.and.returnValue(of(pageOf([])));
    queryParams.next({lastName: 'Zzzz'});
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('No owners with LastName starting with "Zzzz"');
    expect(fixture.debugElement.query(By.css('mat-paginator'))).toBeNull();
  });

  it('only the latest query may answer', () => {
    const slowFirstPage = new Subject<OwnerPage>();
    getOwnerPageSpy.and.returnValue(slowFirstPage);
    fixture.detectChanges();

    getOwnerPageSpy.and.returnValue(of(pageOf([george])));
    queryParams.next({lastName: 'Franklin'});
    slowFirstPage.next(pageOf([george, {...george, id: 2, lastName: 'Davis'}]));

    expect(component.owners).toEqual([george]);
  });
});
