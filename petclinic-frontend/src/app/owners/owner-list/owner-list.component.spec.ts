import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

import {OwnerListComponent} from './owner-list.component';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, convertToParamMap, ParamMap, Router} from '@angular/router';
import {OwnerService} from '../owner.service';
import {Owner} from '../owner';
import {OwnerPage, OwnerQuery} from '../owner-page';
import {BehaviorSubject, Observable, of, Subject, throwError} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {PartsModule} from '../../parts/parts.module';
import {OwnerDetailComponent} from '../owner-detail/owner-detail.component';
import {OwnersModule} from '../owners.module';
import {DummyComponent} from '../../testing/dummy.component';
import {OwnerAddComponent} from '../owner-add/owner-add.component';
import {OwnerEditComponent} from '../owner-edit/owner-edit.component';
import {Pet} from '../../pets/pet';
import Spy = jasmine.Spy;

class OwnerServiceStub {
  getOwnersPage(query: OwnerQuery): Observable<OwnerPage> {
    return of();
  }
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let getOwnersPage: Spy;
  let navigate: Spy;
  // The address bar: a navigation with query params lands here, as the router would put it.
  let url: BehaviorSubject<ParamMap>;

  const george: Owner = {
    id: 1,
    firstName: 'George',
    lastName: 'Darling',
    address: '14 Kensington Gardens',
    city: 'London',
    telephone: '2079372121',
    pets: [{name: 'Nana'} as Pet, {name: 'Tinker'} as Pet]
  };
  const aPage = (content: Owner[], totalElements = content.length): OwnerPage => ({content, totalElements});
  const lastQuery = (): OwnerQuery => getOwnersPage.calls.mostRecent().args[0];
  const text = (css: string) => fixture.debugElement.query(By.css(css))?.nativeElement.textContent.trim();

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule, NoopAnimationsModule,
        RouterTestingModule.withRoutes(
          [{path: 'owners', component: OwnerListComponent},
            {path: 'owners/add', component: OwnerAddComponent},
            {path: 'owners/:id', component: OwnerDetailComponent},
            {path: 'owners/:id/edit', component: OwnerEditComponent}
          ])],
      providers: [
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: ActivatedRoute, useFactory: () => ({queryParamMap: url})}
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    url = new BehaviorSubject(convertToParamMap({}));
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.callFake((commands, extras) => {
      url.next(convertToParamMap(extras?.queryParams ?? {}));
      return Promise.resolve(true);
    });
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    getOwnersPage = spyOn(fixture.debugElement.injector.get(OwnerService), 'getOwnersPage')
      .and.returnValue(of(aPage([george], 23)));
  });

  it('opens on the first 10 owners by name', () => {
    fixture.detectChanges();

    expect(lastQuery()).toEqual({lastName: '', page: 0, size: 10, sort: 'name,asc'});
  });

  it('opens on the search, sort, page and size the address bar names', () => {
    url.next(convertToParamMap({lastName: 'Dar', sort: 'city,desc', page: '3', size: '20'}));
    fixture.detectChanges();

    expect(lastQuery()).toEqual({lastName: 'Dar', page: 2, size: 20, sort: 'city,desc'});
    expect(component.lastName).toBe('Dar');
    expect(text('th.mat-column-city .mat-sort-header-sorted')).toBe('City');
  });

  it('puts every search, sort and page in the address bar, leaving the defaults out', () => {
    fixture.detectChanges();

    component.lastName = 'Dar';
    component.search();
    expect(navigate.calls.mostRecent().args[1].queryParams).toEqual({lastName: 'Dar'});

    component.onPage({pageIndex: 2, previousPageIndex: 0, pageSize: 10, length: 23});
    expect(navigate.calls.mostRecent().args[1].queryParams).toEqual({lastName: 'Dar', page: 3});

    component.onSort({active: 'city', direction: 'desc'});
    expect(navigate.calls.mostRecent().args[1].queryParams).toEqual({lastName: 'Dar', sort: 'city,desc'});
  });

  it('searching the same name again asks again, though the address bar does not change', () => {
    url.next(convertToParamMap({lastName: 'Dar'}));
    fixture.detectChanges();
    getOwnersPage.calls.reset();

    component.search();

    expect(navigate).not.toHaveBeenCalled();
    expect(getOwnersPage).toHaveBeenCalledTimes(1);
  });

  it('shows the last name first, then the first name', () => {
    fixture.detectChanges();

    expect(text('.ownerFullName')).toBe('Darling, George');
  });

  it('lists the pets comma-separated', () => {
    fixture.detectChanges();

    expect(text('.ownerPets')).toBe('Nana, Tinker');
  });

  it('shows the range and the total, and offers 5, 10 or 20 rows', () => {
    fixture.detectChanges();

    expect(text('.mat-mdc-paginator-range-label')).toBe('1 – 10 of 23');
    expect(component.pageSizes).toEqual([5, 10, 20]);
  });

  it('sorts only by Name and City', () => {
    fixture.detectChanges();

    const sortable = fixture.debugElement.queryAll(By.css('th.mat-sort-header'))
      .map(th => th.nativeElement.textContent.trim());
    expect(sortable).toEqual(['Name', 'City']);
  });

  it('a column header toggles ascending and descending, never back to unsorted', () => {
    fixture.detectChanges();
    const cityHeader = fixture.debugElement.queryAll(By.css('th.mat-sort-header'))[1].nativeElement;

    const sorts = [];
    for (let click = 0; click < 3; click++) {
      cityHeader.click();
      fixture.detectChanges();
      sorts.push(lastQuery().sort);
    }

    expect(sorts).toEqual(['city,asc', 'city,desc', 'city,asc']);
  });

  it('a new search, sort or page size goes back to the first page', () => {
    fixture.detectChanges();
    component.onPage({pageIndex: 2, previousPageIndex: 0, pageSize: 10, length: 23});
    expect(lastQuery().page).toBe(2);

    component.lastName = 'Dar';
    component.search();
    expect(lastQuery()).toEqual({lastName: 'Dar', page: 0, size: 10, sort: 'name,asc'});

    component.onPage({pageIndex: 2, previousPageIndex: 0, pageSize: 10, length: 23});
    component.onSort({active: 'city', direction: 'desc'});
    expect(lastQuery().page).toBe(0);

    component.onPage({pageIndex: 2, previousPageIndex: 0, pageSize: 10, length: 23});
    component.onPage({pageIndex: 1, previousPageIndex: 2, pageSize: 20, length: 23});
    expect(lastQuery()).toEqual(jasmine.objectContaining({page: 0, size: 20}));
  });

  // An owner nobody found is exactly the one about to be added.
  it('says no owner matches and still offers Add Owner', () => {
    getOwnersPage.and.returnValue(of(aPage([])));
    fixture.detectChanges();
    component.lastName = 'Zzz';
    component.search();
    fixture.detectChanges();

    expect(text('#noOwners')).toBe('No owners with LastName starting with "Zzz"');
    const buttons = fixture.debugElement.queryAll(By.css('button')).map(b => b.nativeElement.textContent.trim());
    expect(buttons).toContain('Add Owner');
  });

  it('shows a failure as an error, not as "no owners"', () => {
    getOwnersPage.and.returnValue(throwError('server returned code 500'));
    fixture.detectChanges();

    expect(text('#ownersError')).toBe('server returned code 500');
    expect(text('#noOwners')).toBeUndefined();
  });

  it('an earlier page answering late does not overwrite the latest one', () => {
    const firstLoad = new Subject<OwnerPage>();
    getOwnersPage.and.returnValue(firstLoad);
    fixture.detectChanges();

    getOwnersPage.and.returnValue(of(aPage([george], 1)));
    component.lastName = 'Darling';
    component.search();
    firstLoad.next(aPage([{...george, id: 2, lastName: 'Potter'}], 23));

    expect(component.owners).toEqual([george]);
    expect(component.totalOwners).toBe(1);
  });
});
