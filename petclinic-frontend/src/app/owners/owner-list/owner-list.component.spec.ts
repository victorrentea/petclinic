/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {DebugElement, NO_ERRORS_SCHEMA} from '@angular/core';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import { OwnerService } from '../owner.service';
import {Owner, OwnersPage} from '../owner';
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
  getOwnersPage(): Observable<OwnersPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {

  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService = new OwnerServiceStub();
  let getOwnersPageSpy: Spy;
  let de: DebugElement;
  let el: HTMLElement;
  let activatedRoute: ActivatedRouteStub;
  let router: Router;


  const testOwner: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Franklin',
    address: '110 W. Liberty St.',
    city: 'Madison',
    telephone: '6085551023',
    pets: []
  };
  let testOwners: Owner[];
  let ownersPage: OwnersPage;

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
    testOwners = [testOwner];
    ownersPage = {
      items: testOwners,
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      lastName: '',
      sort: {
        field: 'name',
        direction: 'asc'
      }
    };

    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    ownerService = fixture.debugElement.injector.get(OwnerService);
    activatedRoute = TestBed.inject(ActivatedRoute) as any;
    router = TestBed.inject(Router);
    getOwnersPageSpy = spyOn(ownerService, 'getOwnersPage')
      .and.returnValue(of(ownersPage));
    spyOn(router, 'navigate').and.resolveTo(true);

  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call ngOnInit() method', () => {
    activatedRoute.testQueryParams = {};
    fixture.detectChanges();
    expect(getOwnersPageSpy).toHaveBeenCalledWith({
      direction: 'asc',
      lastName: '',
      page: 1,
      pageSize: 10,
      sort: 'name'
    });
  });


  it(' should show full name after getOwners observable (async) ', waitForAsync(() => {
    activatedRoute.testQueryParams = {};
    fixture.detectChanges();
    fixture.whenStable().then(() => { // wait for async getOwners
      fixture.detectChanges();        // update view with name
      de = fixture.debugElement.query(By.css('.ownerFullName'));
      el = de.nativeElement;
      expect(el.innerText).toBe((testOwner.lastName.toString() + ' ' + testOwner.firstName.toString()));
    });
  }));

  it('ngOnInit normalizes invalid query params before loading owners', () => {
    activatedRoute.testQueryParams = {
      direction: 'sideways',
      lastName: 'Fr',
      page: '-2',
      pageSize: '7',
      sort: 'telephone'
    };

    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: {
        direction: 'asc',
        lastName: 'Fr',
        page: 1,
        pageSize: 10,
        sort: 'name'
      },
      replaceUrl: true
    });
    expect(getOwnersPageSpy).toHaveBeenCalledWith({
      direction: 'asc',
      lastName: 'Fr',
      page: 1,
      pageSize: 10,
      sort: 'name'
    });
  });

  it('searchByLastName resets to first page through the URL', () => {
    activatedRoute.testQueryParams = {
      direction: 'desc',
      lastName: 'Old',
      page: '3',
      pageSize: '5',
      sort: 'city'
    };
    fixture.detectChanges();
    (router.navigate as jasmine.Spy).calls.reset();

    component.searchByLastName('Fr');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: {
        direction: 'desc',
        lastName: 'Fr',
        page: 1,
        pageSize: 5,
        sort: 'city'
      }
    });
  });

  it('changeSort toggles the current sort direction', () => {
    activatedRoute.testQueryParams = {
      direction: 'asc',
      lastName: '',
      page: '1',
      pageSize: '10',
      sort: 'name'
    };
    fixture.detectChanges();
    (router.navigate as jasmine.Spy).calls.reset();

    component.changeSort('name');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: {
        direction: 'desc',
        lastName: '',
        page: 1,
        pageSize: 10,
        sort: 'name'
      }
    });
  });

  it('changePageSize resets to the first page', () => {
    activatedRoute.testQueryParams = {
      direction: 'desc',
      lastName: 'Fr',
      page: '3',
      pageSize: '5',
      sort: 'city'
    };
    fixture.detectChanges();
    (router.navigate as jasmine.Spy).calls.reset();

    component.changePageSize(20);

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: {
        direction: 'desc',
        lastName: 'Fr',
        page: 1,
        pageSize: 20,
        sort: 'city'
      }
    });
  });

  it('shows the empty-state message without the grid when no owners match', () => {
    getOwnersPageSpy.and.returnValue(of({
      ...ownersPage,
      items: [],
      totalItems: 0,
      totalPages: 0
    }));
    activatedRoute.testQueryParams = {
      lastName: 'Missing'
    };

    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#ownersTable'))).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No owners with LastName starting with "Missing"');
  });

  it('navigates to the last available page when the URL page is out of range', () => {
    getOwnersPageSpy.and.returnValue(of({
      ...ownersPage,
      items: [],
      page: 9,
      pageSize: 5,
      totalItems: 6,
      totalPages: 2,
      lastName: 'Fr'
    }));
    activatedRoute.testQueryParams = {
      direction: 'asc',
      lastName: 'Fr',
      page: '9',
      pageSize: '5',
      sort: 'name'
    };

    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: {
        direction: 'asc',
        lastName: 'Fr',
        page: 2,
        pageSize: 5,
        sort: 'name'
      }
    });
  });

});
