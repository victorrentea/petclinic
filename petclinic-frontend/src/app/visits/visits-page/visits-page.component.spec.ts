import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ActivatedRoute, convertToParamMap, Params, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {By} from '@angular/platform-browser';
import {BehaviorSubject, Observable, of, Subject, throwError} from 'rxjs';

import {VisitsPageComponent} from './visits-page.component';
import {VisitQuery, VisitService} from '../visit.service';
import {Visit} from '../visit';
import {VisitPage} from '../visit-page';
import {VisitsModule} from '../visits.module';
import Spy = jasmine.Spy;

class VisitServiceStub {
  getVisitsPage(query?: VisitQuery): Observable<VisitPage> {
    return of();
  }
}

/** The URL's query string, as the component reads it. */
class QueryParamsStub {
  private subject = new BehaviorSubject(convertToParamMap({}));
  queryParamMap = this.subject.asObservable();

  set(params: Params) {
    this.subject.next(convertToParamMap(params));
  }
}

describe('VisitsPageComponent', () => {
  let component: VisitsPageComponent;
  let fixture: ComponentFixture<VisitsPageComponent>;
  let getVisitsPage: Spy;
  let navigate: Spy;
  let url: QueryParamsStub;

  const rabies: Visit = {
    id: 1, date: '2024-01-15', description: 'rabies shot', pet: null as any,
    petId: 7, petName: 'Leo', ownerId: 1, ownerFirstName: 'George', ownerLastName: 'Franklin',
  };
  const aPage = (content: Visit[], totalElements = content.length,
    totalPages = Math.ceil(totalElements / 10)): VisitPage =>
    ({content, totalElements, totalPages, number: 0, size: 10});

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [NoopAnimationsModule, VisitsModule, RouterTestingModule],
      providers: [
        {provide: VisitService, useClass: VisitServiceStub},
        {provide: ActivatedRoute, useClass: QueryParamsStub},
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitsPageComponent);
    component = fixture.componentInstance;
    url = TestBed.inject(ActivatedRoute) as unknown as QueryParamsStub;
    getVisitsPage = spyOn(TestBed.inject(VisitService), 'getVisitsPage').and.returnValue(of(aPage([rabies])));
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  const text = (css: string) => fixture.debugElement.query(By.css(css))?.nativeElement.textContent.trim();
  const navigatedTo = () => navigate.calls.mostRecent().args[1].queryParams;

  it('asks for the first page of the latest visits when the URL says nothing', () => {
    fixture.detectChanges();

    expect(getVisitsPage).toHaveBeenCalledWith({page: 0, size: 10, sort: 'date,desc'});
  });

  it('asks for what the URL says, with its 1-based page turned 0-based', () => {
    url.set({page: '3', size: '5', sort: 'owner,asc'});
    fixture.detectChanges();

    expect(getVisitsPage).toHaveBeenCalledWith({page: 2, size: 5, sort: 'owner,asc'});
  });

  it('falls back to the defaults for values the URL gets wrong', () => {
    url.set({page: '-2', size: '7', sort: 'id,asc'});
    fixture.detectChanges();

    expect(getVisitsPage).toHaveBeenCalledWith({page: 0, size: 10, sort: 'date,desc'});
  });

  it('shows each visit with its pet and a link to its owner', () => {
    fixture.detectChanges();

    expect(text('.visit-date')).toBe('2024-01-15');
    expect(text('.visit-description')).toBe('rabies shot');
    expect(text('.visit-pet')).toBe('Leo');
    const owner = fixture.debugElement.query(By.css('a.owner-link'));
    expect(owner.nativeElement.textContent.trim()).toBe('George Franklin');
    expect(owner.nativeElement.getAttribute('href')).toBe('/owners/1');
  });

  it('every column can be sorted', () => {
    fixture.detectChanges();

    const sortable = fixture.debugElement.queryAll(By.css('th[mat-sort-header]'))
      .map(th => th.attributes['mat-sort-header']);
    expect(sortable).toEqual(['date', 'description', 'pet', 'owner']);
  });

  it('offers pages of 5, 10 or 20 visits', () => {
    expect(component.pageSizes).toEqual([5, 10, 20]);
  });

  it('moving to another page keeps the sort and size', () => {
    url.set({size: '5', sort: 'pet,asc'});
    fixture.detectChanges();

    component.onPage({pageIndex: 2, pageSize: 5, length: 26});

    expect(navigatedTo()).toEqual({page: 3, size: 5, sort: 'pet,asc'});
  });

  it('a new page size goes back to the first page', () => {
    url.set({page: '3'});
    fixture.detectChanges();

    component.onPage({pageIndex: 1, pageSize: 20, length: 26});

    expect(navigatedTo()).toEqual({size: 20});
  });

  it('a new sort goes back to the first page', () => {
    url.set({page: '3'});
    fixture.detectChanges();

    component.onSort({active: 'description', direction: 'asc'});

    expect(navigatedTo()).toEqual({sort: 'description,asc'});
  });

  it('leaves the URL clean when everything is back to its default', () => {
    url.set({page: '2', sort: 'pet,asc'});
    fixture.detectChanges();

    component.onSort({active: 'date', direction: 'desc'});

    expect(navigatedTo()).toEqual({});
  });

  it('shows "No visits found." when there are none', () => {
    getVisitsPage.and.returnValue(of(aPage([])));
    fixture.detectChanges();

    expect(text('.no-visits')).toBe('No visits found.');
    expect(fixture.debugElement.query(By.css('#visitsTable'))).toBeNull();
  });

  it('shows a failure as an error, not as "no visits"', () => {
    getVisitsPage.and.returnValue(throwError('server returned code 500'));
    fixture.detectChanges();

    expect(text('#visitsError')).toContain('server returned code 500');
    expect(fixture.debugElement.query(By.css('.no-visits'))).toBeNull();
  });

  it('moves to the last page when the URL points past it', () => {
    getVisitsPage.and.returnValue(of(aPage([], 26, 3)));
    url.set({page: '9'});
    fixture.detectChanges();

    expect(navigatedTo()).toEqual({page: 3});
    expect(navigate.calls.mostRecent().args[1].replaceUrl).toBe(true);
  });

  // A page asked for earlier must not overwrite the one asked for since, when it answers late.
  it('only the latest query may answer', () => {
    const slowAnswer = new Subject<VisitPage>();
    getVisitsPage.and.returnValue(slowAnswer);
    fixture.detectChanges();

    getVisitsPage.and.returnValue(of(aPage([rabies])));
    url.set({sort: 'pet,asc'});
    slowAnswer.next(aPage([{...rabies, id: 2, description: 'stale'}]));

    expect(component.page?.content).toEqual([rabies]);
  });
});
