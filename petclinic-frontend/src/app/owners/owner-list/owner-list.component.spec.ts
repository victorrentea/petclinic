import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, convertToParamMap, Params, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {BehaviorSubject, NEVER, Observable, of, Subject, throwError} from 'rxjs';
import {map} from 'rxjs/operators';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerQuery} from '../owner-page';
import {OwnersModule} from '../owners.module';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  getOwners(query: OwnerQuery): Observable<OwnerPage> {
    return NEVER;
  }
}

describe('OwnerListComponent', () => {
  let fixture: ComponentFixture<OwnerListComponent>;
  let component: OwnerListComponent;
  let queryParams: BehaviorSubject<Params>;
  let getOwnersSpy: Spy;
  let navigateSpy: Spy;

  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: [
      {id: 1, name: 'Leo'} as any,
      {id: 2, name: 'Basil'} as any
    ]
  };
  const pageOf = (content: Owner[], totalElements = content.length): OwnerPage =>
    ({content, page: 0, size: 10, totalElements});

  beforeEach(waitForAsync(() => {
    queryParams = new BehaviorSubject<Params>({});
    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [FormsModule, OwnersModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useValue: {queryParamMap: queryParams.pipe(map(convertToParamMap))}}
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    getOwnersSpy = spyOn(TestBed.inject(OwnerService), 'getOwners').and.returnValue(of(pageOf([testOwner])));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  const render = () => fixture.detectChanges();
  const query = (css: string) => fixture.debugElement.query(By.css(css));
  const navigatedTo = () => navigateSpy.calls.mostRecent().args[1].queryParams;

  it('loads the first page sorted by name when the URL has no query params', () => {
    render();
    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('sends the URL query params to the service and shows lastName in the search box', waitForAsync(() => {
    queryParams.next({lastName: 'Pot', page: '2', size: '5', sort: 'city,desc'});
    render();
    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: 'Pot', page: 2, size: 5, sort: 'city,desc'});
    fixture.whenStable().then(() => {
      expect(query('#lastName').nativeElement.value).toBe('Pot');
    });
  }));

  it('falls back to the defaults for an unknown size, sort or page in the URL', () => {
    queryParams.next({page: 'abc', size: '1000', sort: 'telephone,asc'});
    render();
    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('reloads when the URL changes', () => {
    render();
    queryParams.next({page: '1'});
    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 1, size: 10, sort: 'name,asc'});
  });

  it('keeps only the latest answer when the URL changes while a load is in flight', () => {
    const slowFirstLoad = new Subject<OwnerPage>();
    getOwnersSpy.and.returnValues(slowFirstLoad, of(pageOf([testOwner])));
    render();
    queryParams.next({lastName: 'Franklin'});
    slowFirstLoad.next(pageOf([{...testOwner, id: 2, lastName: 'Davis'}]));

    expect(component.ownerPage.content).toEqual([testOwner]);
  });

  it('a search navigates to page 0 with the new lastName, merging the other params', () => {
    render();
    component.searchByLastName('Fr');
    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({queryParamsHandling: 'merge'}));
    expect(navigatedTo()).toEqual({lastName: 'Fr', page: 0});
  });

  it('searching again for what is already shown reloads it, though the URL does not change', () => {
    queryParams.next({lastName: 'Pot'});
    render();
    getOwnersSpy.calls.reset();
    component.searchByLastName('Pot');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(getOwnersSpy).toHaveBeenCalledWith({lastName: 'Pot', page: 0, size: 10, sort: 'name,asc'});
  });

  it('a page past the last one moves to the last page, replacing the URL', () => {
    queryParams.next({page: '99'});
    getOwnersSpy.and.returnValue(of({content: [], page: 99, size: 10, totalElements: 12}));
    render();
    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({replaceUrl: true}));
    expect(navigatedTo()).toEqual({page: 1});
  });

  it('a sort or page click keeps the text typed in the search box but not searched yet', () => {
    render();
    component.lastName = 'Pot';
    queryParams.next({sort: 'city,asc', page: '0'});
    expect(component.lastName).toBe('Pot');
  });

  it('the empty message names the search it answers, not the one still loading', () => {
    queryParams.next({lastName: 'Zzzz'});
    getOwnersSpy.and.returnValues(of(pageOf([], 0)), NEVER);
    render();
    queryParams.next({lastName: 'Pot'});
    fixture.detectChanges();
    expect(query('#noOwners').nativeElement.innerText).toBe('No owners with last name starting with "Zzzz"');
  });

  it('a page-size change forwards the page the paginator computed to keep the first owner on screen', () => {
    render();
    component.onPage({pageIndex: 1, pageSize: 20, previousPageIndex: 5, length: 100});
    expect(navigatedTo()).toEqual({page: 1, size: 20});
  });

  it('a search for an empty lastName drops it from the URL', () => {
    queryParams.next({lastName: 'Pot'});
    render();
    component.searchByLastName('');
    expect(navigatedTo()).toEqual({lastName: null, page: 0});
  });

  it('clicking the City header navigates to page 0 sorted by city ascending', () => {
    queryParams.next({page: '3'});
    render();
    query('#cityHeader').nativeElement.click();
    expect(navigatedTo()).toEqual({sort: 'city,asc', page: 0});
  });

  it('the paginator forwards page and size', () => {
    getOwnersSpy.and.returnValue(of(pageOf([testOwner], 42)));
    render();
    query('#ownersPaginator button[aria-label="Next page"]').nativeElement.click();
    expect(navigatedTo()).toEqual({page: 1, size: 10});
  });

  it('shows the owner full name, city and pets inline', () => {
    render();
    expect(query('.ownerFullName').nativeElement.innerText).toBe('Franklin, George');
    expect(query('.ownerCity').nativeElement.innerText).toBe('Madison');
    expect(query('.ownerPets').nativeElement.innerText).toBe('Leo, Basil');
  });

  it('shows the empty message and hides the table and paginator when nothing matches', () => {
    queryParams.next({lastName: 'Zzzz'});
    getOwnersSpy.and.returnValue(of(pageOf([], 0)));
    render();
    expect(query('#noOwners').nativeElement.innerText).toBe('No owners with last name starting with "Zzzz"');
    expect(query('#ownersTable')).toBeNull();
    expect(query('#ownersPaginator')).toBeNull();
  });

  it('shows the error, not the empty message, when the load fails', () => {
    getOwnersSpy.and.returnValue(throwError('server returned code 500'));
    render();
    expect(query('#noOwners')).toBeNull();
    expect(query('#ownersError').nativeElement.innerText).toContain('server returned code 500');
  });

  it('keeps Add Owner visible on an empty result', () => {
    getOwnersSpy.and.returnValue(of(pageOf([], 0)));
    render();
    expect(query('#addOwner')).not.toBeNull();
  });
});
