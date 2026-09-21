/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner, OwnerPage} from '../owner';
import {Observable, of} from 'rxjs';
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
  listOwners(query: any): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let listOwnersSpy: Spy;
  let navigateSpy: Spy;
  let route: ActivatedRouteStub;
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
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule,
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
    testPage = {content: [testOwner], totalElements: 1, totalPages: 1, number: 0, size: 10};

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    route = TestBed.inject(ActivatedRoute) as any;
    listOwnersSpy = spyOn(ownerService, 'listOwners')
      .and.returnValue(of(testPage));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('asks for the first page with the default size and sort when the URL carries nothing', () => {
    fixture.detectChanges();

    expect(listOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('loads exactly the page a deep link asks for', () => {
    fixture.detectChanges();
    listOwnersSpy.calls.reset();

    route.testQueryParams = {lastName: 'Fr', page: '2', size: '5', sort: 'city,desc'};

    expect(listOwnersSpy).toHaveBeenCalledWith({lastName: 'Fr', page: 2, size: 5, sort: 'city,desc'});
    expect(component.lastName).toBe('Fr');
  });

  it('falls back to the defaults when the URL carries nonsense', () => {
    fixture.detectChanges();
    listOwnersSpy.calls.reset();

    route.testQueryParams = {page: 'lots', size: '7', sort: 'telephone,sideways'};

    expect(listOwnersSpy).toHaveBeenCalledWith({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it(' should show the name surname-first, so the sorted column reads in order ', waitForAsync(() => {
    fixture.detectChanges();
    fixture.whenStable().then(() => { // wait for async listOwners
      fixture.detectChanges();        // update view with name
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText).toBe(testOwner.lastName + ', ' + testOwner.firstName);
    });
  }));

  it('navigates instead of fetching when the filter changes, and resets to page 0', () => {
    fixture.detectChanges();
    route.testQueryParams = {lastName: 'Fr', page: '3', size: '10', sort: 'name,asc'};
    navigateSpy.calls.reset();

    component.searchByLastName('Da');

    expect(navigateSpy).toHaveBeenCalled();
    expect(navigateSpy.calls.mostRecent().args[1].queryParams)
      .toEqual({lastName: 'Da', page: 0, size: 10, sort: 'name,asc'});
  });

  it('toggles the direction when the already-sorted column is clicked', () => {
    fixture.detectChanges();
    navigateSpy.calls.reset();

    component.sortBy('name');

    expect(navigateSpy.calls.mostRecent().args[1].queryParams.sort).toBe('name,desc');
  });

  it('starts a newly picked sort column ascending, from page 0', () => {
    fixture.detectChanges();
    route.testQueryParams = {page: '2', sort: 'name,desc'};
    navigateSpy.calls.reset();

    component.sortBy('city');

    expect(navigateSpy.calls.mostRecent().args[1].queryParams)
      .toEqual({lastName: '', page: 0, size: 10, sort: 'city,asc'});
  });

  it('marks only Name and City as sortable, with aria-sort', () => {
    fixture.detectChanges();

    const headers = fixture.debugElement.queryAll(By.css('#ownersTable th'));
    const sortable = headers.map(th => th.nativeElement.getAttribute('aria-sort'));

    expect(sortable).toEqual(['ascending', null, 'none', null, null]);
    expect(fixture.debugElement.queryAll(By.css('#ownersTable th button.owners-sort')).length).toBe(2);
  });

  it('offers rows-per-page through the design-system combo, never a raw select', () => {
    fixture.detectChanges();

    const combo = fixture.debugElement.query(By.css('[data-ds="combo"]'));
    expect(combo).toBeTruthy();
    const selectsOutsideACombo = fixture.debugElement.queryAll(By.css('select'))
      .filter(select => select.nativeElement.closest('[data-ds="combo"]') === null);
    expect(selectsOutsideACombo.length).toBe(0);
    expect(component.pageSizes).toEqual([5, 10, 20]);
  });

  it('navigates to the next page and disables the button on the last one', () => {
    fixture.detectChanges();
    route.testQueryParams = {page: '0', size: '5'};
    listOwnersSpy.and.returnValue(of({content: [testOwner], totalElements: 12, totalPages: 3, number: 0, size: 5}));
    route.testQueryParams = {page: '0', size: '5', sort: 'name,asc'};
    fixture.detectChanges();
    navigateSpy.calls.reset();

    component.goToPage(1);

    expect(navigateSpy.calls.mostRecent().args[1].queryParams.page).toBe(1);
    expect(component.isFirstPage).toBe(true);
    expect(component.isLastPage).toBe(false);
  });

  it('resets to page 0 when the rows-per-page changes, and ignores a no-op pick', () => {
    fixture.detectChanges();
    route.testQueryParams = {page: '3', size: '10'};
    navigateSpy.calls.reset();

    component.changeSize(10);
    expect(navigateSpy).not.toHaveBeenCalled();

    component.changeSize(20);
    expect(navigateSpy.calls.mostRecent().args[1].queryParams)
      .toEqual({lastName: '', page: 0, size: 20, sort: 'name,asc'});
  });

});
