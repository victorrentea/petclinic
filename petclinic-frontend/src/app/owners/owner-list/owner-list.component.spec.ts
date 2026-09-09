import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject, Observable, of } from 'rxjs';

import { OwnerListComponent } from './owner-list.component';
import { OwnersModule } from '../owners.module';
import { OwnerService } from '../owner.service';
import { Owner } from '../owner';
import { OwnerPage, OwnerQuery } from '../owner-page';
import { PartsModule } from '../../parts/parts.module';
import { DummyComponent } from '../../testing/dummy.component';
import Spy = jasmine.Spy;

/** ActivatedRoute with a query string the test can change, which is the grid's input. */
class QueryParamRouteStub {
  private readonly subject = new BehaviorSubject<ParamMap>(convertToParamMap({}));
  queryParamMap = this.subject.asObservable();

  get snapshot() {
    return { queryParamMap: this.subject.value };
  }

  setQuery(params: Record<string, string>) {
    this.subject.next(convertToParamMap(params));
  }
}

class OwnerServiceStub {
  getOwnerPage(query: OwnerQuery): Observable<OwnerPage> {
    return of(emptyPage());
  }
}

const harry: Owner = {
  id: 2, firstName: 'Harry', lastName: 'Potter', address: '4 Privet Drive',
  city: 'Little Whinging', telephone: '0119084455', pets: [],
};

function pageOf(content: Owner[], overrides: Partial<OwnerPage> = {}): OwnerPage {
  return {
    content, totalElements: content.length, totalPages: 1, number: 0, size: 10, ...overrides,
  };
}

function emptyPage(): OwnerPage {
  return pageOf([], { totalElements: 0, totalPages: 0 });
}

describe('OwnerListComponent', () => {
  let component: OwnerListComponent;
  let fixture: ComponentFixture<OwnerListComponent>;
  let ownerService: OwnerServiceStub;
  let route: QueryParamRouteStub;
  let getOwnerPageSpy: Spy;
  let navigateSpy: Spy;

  beforeEach(waitForAsync(() => {
    route = new QueryParamRouteStub();
    ownerService = new OwnerServiceStub();

    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, FormsModule, PartsModule, OwnersModule,
        NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: OwnerService, useValue: ownerService },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnerListComponent);
    component = fixture.componentInstance;
    getOwnerPageSpy = spyOn(ownerService, 'getOwnerPage').and.returnValue(of(pageOf([harry])));
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate');
  });

  it('should create OwnerListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('asks for the first page with the default sort when the URL is bare', () => {
    fixture.detectChanges();

    expect(getOwnerPageSpy).toHaveBeenCalledWith(
      { lastName: '', page: 0, size: 10, sort: 'name,asc' });
  });

  it('asks for exactly what the URL says', () => {
    route.setQuery({ lastName: 'Pot', page: '2', size: '5', sort: 'city,desc' });
    fixture.detectChanges();

    expect(getOwnerPageSpy).toHaveBeenCalledWith(
      { lastName: 'Pot', page: 2, size: 5, sort: 'city,desc' });
  });

  it('reloads when the query parameters change', () => {
    fixture.detectChanges();
    getOwnerPageSpy.calls.reset();

    route.setQuery({ page: '1' });
    fixture.detectChanges();

    expect(getOwnerPageSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the name surname-first, the order the column sorts in', () => {
    fixture.detectChanges();

    const cell = fixture.debugElement.query(By.css('.ownerFullName')).nativeElement;
    expect(cell.innerText.trim()).toBe('Potter, Harry');
  });

  it('shows the "no owners" message only once an empty page has come back', () => {
    getOwnerPageSpy.and.returnValue(of(emptyPage()));
    fixture.detectChanges();

    expect(component.isEmpty).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No owners');
  });

  it('does not claim "no owners" before anything has loaded', () => {
    expect(component.isEmpty).toBe(false);
  });

  it('a new search goes back to the first page and keeps the sort', () => {
    route.setQuery({ page: '3', sort: 'city,desc' });
    fixture.detectChanges();

    component.searchByLastName('Pot');

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { lastName: 'Pot', page: 0 },
      queryParamsHandling: 'merge',
    }));
  });

  it('paging navigates instead of fetching directly', () => {
    fixture.detectChanges();

    component.onPage({ pageIndex: 2, pageSize: 5, length: 28 });

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { page: 2, size: 5 },
    }));
  });

  it('sorting navigates, and restarts at the first page', () => {
    fixture.detectChanges();

    component.onSort({ active: 'city', direction: 'desc' });

    expect(navigateSpy).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: { sort: 'city,desc', page: 0 },
    }));
  });
});
