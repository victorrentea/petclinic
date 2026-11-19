import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ActivatedRoute, convertToParamMap, ParamMap, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnersModule} from '../owners.module';
import {OwnerService} from '../owner.service';
import {Owner, OwnerPage, OwnerQuery} from '../owner';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  listOwners(query: OwnerQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let listOwnersSpy: Spy;
  let navigateSpy: Spy;
  let queryParams: BehaviorSubject<ParamMap>;

  const george: Owner = {
    id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.',
    city: 'Madison', telephone: '6085551023', pets: []
  };
  const pageOf = (owners: Owner[], totalElements = owners.length): OwnerPage =>
    ({content: owners, page: 0, size: 10, totalElements});

  beforeEach(waitForAsync(() => {
    queryParams = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useValue: {queryParamMap: queryParams}},
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    listOwnersSpy = spyOn(TestBed.inject(OwnerService), 'listOwners').and.returnValue(of(pageOf([george])));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  const headerTexts = (selector: string) =>
    fixture.debugElement.queryAll(By.css(selector)).map(de => de.nativeElement.textContent.trim());

  it('loads the default page when the URL says nothing', () => {
    fixture.detectChanges();

    expect(listOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('loads the page, size, sort and search the URL holds', () => {
    queryParams.next(convertToParamMap({lastName: 'Pot', page: '2', size: '20', sort: 'city,desc'}));
    fixture.detectChanges();

    expect(listOwnersSpy).toHaveBeenCalledWith({lastName: 'Pot', page: 2, size: 20, sort: 'city,desc'});
    expect(component.lastName).toBe('Pot');
  });

  it('ignores a size or sort the list does not allow', () => {
    queryParams.next(convertToParamMap({size: '7', sort: 'telephone,asc', page: '-1'}));
    fixture.detectChanges();

    expect(listOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('shows each owner\'s full name', () => {
    fixture.detectChanges();

    expect(headerTexts('#ownersTable td.ownerFullName')).toEqual(['George Franklin']);
  });

  it('a search goes back to the first page', () => {
    component.searchByLastName('Pot');

    expect(navigateSpy.calls.mostRecent().args[1].queryParams).toEqual({lastName: 'Pot', page: 0});
  });

  it('a sort change goes back to the first page', () => {
    component.onSort({active: 'city', direction: 'desc'});

    expect(navigateSpy.calls.mostRecent().args[1].queryParams).toEqual({sort: 'city,desc', page: 0});
  });

  it('a page-size change keeps the page MatPaginator computed', () => {
    component.onPage({pageIndex: 1, pageSize: 10, previousPageIndex: 2, length: 26});

    expect(navigateSpy.calls.mostRecent().args[1].queryParams).toEqual({page: 1, size: 10});
  });

  it('only Name and City can be sorted', () => {
    fixture.detectChanges();

    expect(headerTexts('th[mat-sort-header]')).toEqual(['Name', 'City']);
  });

  it('an empty result says so and shows no paginator', () => {
    listOwnersSpy.and.returnValue(of(pageOf([], 0)));
    queryParams.next(convertToParamMap({lastName: 'Zzzz'}));
    fixture.detectChanges();

    expect(headerTexts('#noOwners')).toEqual(['No owners with last name starting with "Zzzz"']);
    expect(fixture.debugElement.query(By.css('mat-paginator'))).toBeNull();
  });

  it('a slow earlier page never overwrites a newer one', () => {
    const slowFirstPage = new Subject<OwnerPage>();
    listOwnersSpy.and.returnValues(slowFirstPage, of(pageOf([george])));
    fixture.detectChanges();

    queryParams.next(convertToParamMap({lastName: 'Franklin'}));
    slowFirstPage.next(pageOf([{...george, id: 2, lastName: 'Davis'}]));

    expect(component.owners).toEqual([george]);
  });
});
