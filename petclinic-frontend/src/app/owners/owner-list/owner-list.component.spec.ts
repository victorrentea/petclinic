import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, convertToParamMap, ParamMap, Params, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {CommonModule} from '@angular/common';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import Spy = jasmine.Spy;

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerPageQuery} from '../owner-page';
import {OwnersModule} from '../owners.module';

class OwnerServiceStub {
  getOwnersPage(query: OwnerPageQuery): Observable<OwnerPage> {
    return of();
  }
}

class QueryParamsRouteStub {
  private readonly params = new BehaviorSubject<ParamMap>(convertToParamMap({}));
  readonly queryParamMap = this.params.asObservable();

  setQueryParams(params: Params) {
    this.params.next(convertToParamMap(params));
  }
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let route: QueryParamsRouteStub;
  let getOwnersPageSpy: Spy;
  let navigateSpy: Spy;

  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  const pageOf = (content: Owner[], totalElements = content.length): OwnerPage =>
    ({content, totalElements, totalPages: Math.ceil(totalElements / 10), number: 0, size: 10});

  const lastNavigation = () => navigateSpy.calls.mostRecent().args[1];

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useClass: QueryParamsRouteStub}
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    route = TestBed.inject(ActivatedRoute) as unknown as QueryParamsRouteStub;
    getOwnersPageSpy = spyOn(TestBed.inject(OwnerService), 'getOwnersPage')
      .and.returnValue(of(pageOf([testOwner], 26)));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  it('loads the first page of 10 sorted by name when the URL says nothing', () => {
    fixture.detectChanges();

    expect(getOwnersPageSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('loads the page, size, sort and filter the URL holds', () => {
    route.setQueryParams({lastName: 'Fr', page: '2', size: '5', sort: 'city,desc'});
    fixture.detectChanges();

    expect(getOwnersPageSpy).toHaveBeenCalledWith({lastName: 'Fr', page: 2, size: 5, sort: 'city,desc'});
    expect(component.lastName).toBe('Fr');
  });

  it('falls back to the defaults on a URL it cannot honour', () => {
    route.setQueryParams({page: '-1', size: '50', sort: 'telephone,asc'});
    fixture.detectChanges();

    expect(getOwnersPageSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('shows the owners of the page', () => {
    fixture.detectChanges();

    const name = fixture.debugElement.query(By.css('#ownersTable .ownerFullName')).nativeElement;
    expect(name.innerText).toBe('George Franklin');
  });

  it('offers sorting on Name and City only, Name ascending by default', () => {
    fixture.detectChanges();

    const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
      .map(th => th.nativeElement.textContent.trim());
    expect(sortable).toEqual(['Name', 'City']);
    const active = fixture.debugElement.query(By.css('th[aria-sort="ascending"]')).nativeElement;
    expect(active.textContent.trim()).toBe('Name');
  });

  it('shows the total in the paginator', () => {
    fixture.detectChanges();

    const range = fixture.debugElement.query(By.css('.mat-mdc-paginator-range-label')).nativeElement;
    expect(range.textContent.trim()).toBe('1 – 10 of 26');
  });

  it('a page change only rewrites the URL, keeping the rest of the state', () => {
    route.setQueryParams({lastName: 'Fr', sort: 'city,asc'});
    fixture.detectChanges();

    component.onPage({pageIndex: 1, pageSize: 5, previousPageIndex: 0, length: 26});

    expect(lastNavigation().queryParams).toEqual({lastName: 'Fr', page: 1, size: 5, sort: 'city,asc'});
    expect(lastNavigation().replaceUrl).toBe(true);
    expect(getOwnersPageSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking the City header sorts by city ascending, back on the first page', () => {
    route.setQueryParams({page: '2'});
    fixture.detectChanges();

    fixture.debugElement.query(By.css('th[mat-sort-header="city"]')).nativeElement.click();

    expect(lastNavigation().queryParams).toEqual({lastName: null, page: null, size: null, sort: 'city,asc'});
  });

  it('clicking the active header again sorts descending', () => {
    route.setQueryParams({sort: 'city,asc'});
    fixture.detectChanges();

    fixture.debugElement.query(By.css('th[mat-sort-header="city"]')).nativeElement.click();

    expect(lastNavigation().queryParams.sort).toBe('city,desc');
  });

  it('a search goes back to the first page', () => {
    route.setQueryParams({page: '3', size: '5'});
    fixture.detectChanges();

    component.searchByLastName('Potter');

    expect(lastNavigation().queryParams).toEqual({lastName: 'Potter', page: null, size: 5, sort: null});
  });

  it('says so when no owner matches', () => {
    getOwnersPageSpy.and.returnValue(of(pageOf([])));
    route.setQueryParams({lastName: 'Zz'});
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No owners with LastName starting with "Zz"');
    expect(fixture.debugElement.query(By.css('#ownersTable'))).toBeNull();
  });

  it('only the answer to the latest URL lands, however late an older one arrives', () => {
    const firstAnswer = new Subject<OwnerPage>();
    getOwnersPageSpy.and.returnValues(firstAnswer, of(pageOf([testOwner])));
    fixture.detectChanges();

    route.setQueryParams({lastName: 'Franklin'});
    firstAnswer.next(pageOf([testOwner, {...testOwner, id: 2, lastName: 'Davis'}]));

    expect(component.page.content).toEqual([testOwner]);
  });
});
