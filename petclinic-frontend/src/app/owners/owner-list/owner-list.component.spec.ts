import {ComponentFixture, TestBed, fakeAsync, tick} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, convertToParamMap, Router} from '@angular/router';
import {BehaviorSubject, of} from 'rxjs';

import {OwnerListComponent} from './owner-list.component';
import {OwnerService} from '../owner.service';
import {OwnerPage} from '../owner-page';

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let queryParamMap$: BehaviorSubject<any>;
  let ownerServiceSpy: jasmine.SpyObj<OwnerService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const ownerPage: OwnerPage = {
    content: [{
      id: 1,
      firstName: 'George',
      lastName: 'Franklin',
      address: '110 W. Liberty St.',
      city: 'Madison',
      telephone: '6085551023',
      pets: []
    }],
    number: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1
  };

  beforeEach(async () => {
    queryParamMap$ = new BehaviorSubject(convertToParamMap({}));
    ownerServiceSpy = jasmine.createSpyObj('OwnerService', ['getOwnersPage']);
    ownerServiceSpy.getOwnersPage.and.returnValue(of(ownerPage));
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [OwnerListComponent],
      imports: [FormsModule],
      providers: [
        {provide: OwnerService, useValue: ownerServiceSpy},
        {provide: Router, useValue: routerSpy},
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamMap$.asObservable()
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads first page with defaults when no query params are present', () => {
    fixture.detectChanges();

    expect(ownerServiceSpy.getOwnersPage).toHaveBeenCalledWith({
      page: 0,
      size: 20,
      sort: 'id,asc',
      q: ''
    });
  });

  it('loads using query params from URL', () => {
    fixture.detectChanges();
    ownerServiceSpy.getOwnersPage.calls.reset();

    queryParamMap$.next(convertToParamMap({page: '2', size: '50', sort: 'id,desc', q: 'geo'}));

    expect(ownerServiceSpy.getOwnersPage).toHaveBeenCalledWith({
      page: 2,
      size: 50,
      sort: 'id,desc',
      q: 'geo'
    });
  });

  it('resets to first page when page size changes', () => {
    fixture.detectChanges();
    component.page = 3;
    component.query = 'fr';

    component.onPageSizeChange(10);

    expect(routerSpy.navigate).toHaveBeenCalled();
    const navigation = routerSpy.navigate.calls.mostRecent().args[1];
    expect(navigation.queryParams.page).toBe(0);
    expect(navigation.queryParams.size).toBe(10);
    expect(navigation.queryParams.q).toBe('fr');
  });

  it('debounces search term and updates URL with q', fakeAsync(() => {
    fixture.detectChanges();

    component.onSearchTermChange('dav');
    tick(499);
    expect(routerSpy.navigate).not.toHaveBeenCalled();

    tick(1);
    expect(routerSpy.navigate).toHaveBeenCalled();
    const navigation = routerSpy.navigate.calls.mostRecent().args[1];
    expect(navigation.queryParams.q).toBe('dav');
    expect(navigation.queryParams.page).toBe(0);
  }));

  it('builds page links with first, current window, and last pages', () => {
    ownerServiceSpy.getOwnersPage.and.returnValue(of({
      ...ownerPage,
      number: 10,
      totalPages: 30,
      totalElements: 300
    }));

    fixture.detectChanges();

    expect(component.pageLinks).toContain(0);
    expect(component.pageLinks).toContain(1);
    expect(component.pageLinks).toContain(2);
    expect(component.pageLinks).toContain(8);
    expect(component.pageLinks).toContain(10);
    expect(component.pageLinks).toContain(12);
    expect(component.pageLinks).toContain(28);
    expect(component.pageLinks).toContain(29);
    expect(component.pageLinks).toContain('ellipsis');
  });
});
