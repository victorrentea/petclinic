import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { OwnerListComponent, PAGE_SIZE_OPTIONS } from './owner-list.component';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { OwnerPage } from '../owner-page';

function pageOf(content: Owner[], totalElements = content.length, totalPages = 1, number = 0): OwnerPage {
  return { content, totalElements, totalPages, number, size: 10 };
}

const georgeFranklin: Owner = {
  id: 1, firstName: 'George', lastName: 'Franklin',
  address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023', pets: []
};

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let getOwnersSpy: jasmine.Spy;
  let routerSpy: jasmine.SpyObj<Router>;
  let queryParamMap: ParamMap;

  function setup() {
    const ownerService = { getOwners: () => of(pageOf([georgeFranklin])) };
    getOwnersSpy = spyOn(ownerService, 'getOwners').and.callThrough();
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      declarations: [OwnerListComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: OwnerService, useValue: ownerService },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    queryParamMap = convertToParamMap({});
  });

  it('loads the first page sorted by lastName asc by default', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 0, size: 10, sort: 'name,asc', lastName: '' })
    );
  }));

  it('restores page/size/sort/lastName from the URL query params', waitForAsync(() => {
    queryParamMap = convertToParamMap({ page: '3', size: '5', sort: 'city,desc', lastName: 'Fr' });
    setup();
    fixture.detectChanges();
    expect(getOwnersSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 3, size: 5, sort: 'city,desc', lastName: 'Fr' })
    );
  }));

  it('renders the Name column last-name-first', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    const cell = fixture.debugElement.query(By.css('.ownerFullName'));
    expect(cell.nativeElement.textContent.trim()).toBe('Franklin George');
  }));

  it('exposes only Name and City as sortable headers', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('#sort-name'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#sort-city'))).toBeTruthy();
    const sortableCount = fixture.debugElement.queryAll(By.css('th.sortable')).length;
    expect(sortableCount).toBe(2);
  }));

  it('shows ▲ on the active column and a faded ↕ hint on the other sortable column', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    // default sort is name asc
    expect(component.sortIndicator('name')).toBe('▲');
    expect(component.isSorted('name')).toBeTrue();
    expect(component.sortIndicator('city')).toBe('↕');
    expect(component.isSorted('city')).toBeFalse();

    component.toggleSort('city');
    expect(component.sortIndicator('city')).toBe('▲');
    expect(component.sortIndicator('name')).toBe('↕');
  }));

  it('toggles the Name sort two-state asc <-> desc and resets to page 0', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    component.page = 4;

    component.toggleSort('name');
    expect(component.sort).toBe('name,desc');
    expect(component.page).toBe(0);

    component.toggleSort('name');
    expect(component.sort).toBe('name,asc');
  }));

  it('switching to City sort starts ascending', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    component.toggleSort('city');
    expect(component.sort).toBe('city,asc');
  }));

  it('offers page sizes 5/10/20 with 10 as default', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    expect(component.pageSizeOptions).toEqual(PAGE_SIZE_OPTIONS);
    expect(PAGE_SIZE_OPTIONS).toEqual([5, 10, 20]);
    expect(component.size).toBe(10);
  }));

  it('changing page size resets to page 0', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    component.page = 3;
    component.onPage({ pageIndex: 3, pageSize: 20, length: 100 });
    expect(component.size).toBe(20);
    expect(component.page).toBe(0);
  }));

  it('navigating to another page keeps the page index', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    component.onPage({ pageIndex: 2, pageSize: 10, length: 100 });
    expect(component.page).toBe(2);
  }));

  it('syncs the view to the URL on search', waitForAsync(() => {
    setup();
    fixture.detectChanges();
    routerSpy.navigate.calls.reset();
    component.search('Dav');
    expect(routerSpy.navigate).toHaveBeenCalled();
    const extras = routerSpy.navigate.calls.mostRecent().args[1];
    expect(extras.queryParams).toEqual(jasmine.objectContaining({ lastName: 'Dav', page: 0 }));
  }));

  it('shows "No owners found" and hides the paginator when there are no results', waitForAsync(() => {
    const ownerService = { getOwners: () => of(pageOf([], 0, 0)) };
    getOwnersSpy = spyOn(ownerService, 'getOwners').and.callThrough();
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      declarations: [OwnerListComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: OwnerService, useValue: ownerService },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#noOwnersFound'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#ownersPaginator'))).toBeNull();
  }));

  it('clamps an out-of-range page to the last valid page', waitForAsync(() => {
    const ownerService = {
      getOwners: jasmine.createSpy('getOwners').and.returnValues(
        of(pageOf([], 50, 5)),          // requested page 9 is out of range -> empty content
        of(pageOf([georgeFranklin], 50, 5)) // reload of clamped last page
      )
    };
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      declarations: [OwnerListComponent],
      imports: [CommonModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: OwnerService, useValue: ownerService },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ page: '9' }) } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.page).toBe(4); // totalPages 5 -> last index 4
    expect(ownerService.getOwners).toHaveBeenCalledTimes(2);
  }));
});
