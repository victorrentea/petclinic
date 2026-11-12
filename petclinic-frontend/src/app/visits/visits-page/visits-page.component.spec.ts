import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {By} from '@angular/platform-browser';

import {VisitsPageComponent} from './visits-page.component';
import {VisitService} from '../visit.service';
import {VisitPage, VisitPageQuery, VisitRow} from '../visit';

class VisitServiceStub {
  getVisitPage(query: VisitPageQuery): Observable<VisitPage> {
    return of();
  }
}

describe('VisitsPageComponent', () => {
  let component: VisitsPageComponent;
  let fixture: ComponentFixture<VisitsPageComponent>;
  let visitService: VisitServiceStub;
  let queryParams: BehaviorSubject<Params>;

  const rows: VisitRow[] = [
    {id: 2, date: '2025-06-04', description: 'checkup', petId: 8, petName: 'Basil',
      ownerId: 2, ownerFirstName: 'Betty', ownerLastName: 'Davis'},
    {id: 1, date: '2024-01-15', description: 'rabies shot', petId: 7, petName: 'Leo',
      ownerId: 1, ownerFirstName: 'George', ownerLastName: 'Franklin'},
  ];
  const page = (content: VisitRow[], extra: Partial<VisitPage> = {}): VisitPage =>
    ({content, page: 0, size: 10, totalElements: content.length, totalPages: 1, sort: 'date,desc', ...extra});

  beforeEach(waitForAsync(() => {
    queryParams = new BehaviorSubject<Params>({});
    TestBed.configureTestingModule({
      declarations: [VisitsPageComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, RouterTestingModule],
      providers: [
        {provide: VisitService, useClass: VisitServiceStub},
        {provide: ActivatedRoute, useValue: {queryParams}},
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitsPageComponent);
    component = fixture.componentInstance;
    visitService = TestBed.inject(VisitService) as unknown as VisitServiceStub;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('asks for the page, size and sort in the URL', () => {
    const spy = spyOn(visitService, 'getVisitPage').and.returnValue(of(page(rows)));
    queryParams.next({page: '2', size: '5', sort: 'pet,asc'});
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith({page: '2', size: '5', sort: 'pet,asc'});
  });

  it('shows the rows, paging and sort the backend served', () => {
    spyOn(visitService, 'getVisitPage').and.returnValue(of(page(rows, {page: 1, size: 5, sort: 'owner,asc'})));
    fixture.detectChanges();

    expect(component.visits).toEqual(rows);
    expect(component.page).toBe(1);
    expect(component.size).toBe(5);
    expect(component.sortColumn).toBe('owner');
    expect(component.sortDirection).toBe('asc');
  });

  it('re-queries when the URL changes', () => {
    const spy = spyOn(visitService, 'getVisitPage').and.returnValue(of(page(rows)));
    fixture.detectChanges();
    queryParams.next({page: '1'});

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('puts a new sort in the URL, back on the first page', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate');
    component.onSort({active: 'description', direction: 'asc'});

    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({
      queryParams: {sort: 'description,asc', page: null}, queryParamsHandling: 'merge',
    }));
  });

  it('puts a new page and size in the URL', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate');
    component.onPage({pageIndex: 3, pageSize: 20, length: 100});

    expect(navigate).toHaveBeenCalledWith([], jasmine.objectContaining({queryParams: {page: 3, size: 20}}));
  });

  it('shows "No visits found." when the clinic has no visits', () => {
    spyOn(visitService, 'getVisitPage').and.returnValue(of(page([])));
    fixture.detectChanges();

    const empty = fixture.debugElement.query(By.css('.no-visits'));
    expect(empty.nativeElement.textContent).toContain('No visits found.');
  });

  it('renders owner cell as a link to /owners/{ownerId}', () => {
    spyOn(visitService, 'getVisitPage').and.returnValue(of(page(rows)));
    fixture.detectChanges();

    const links = fixture.debugElement.queryAll(By.css('a.owner-link'));
    expect(links).toHaveSize(rows.length);
    expect(links[0].nativeElement.getAttribute('href')).toBe('/owners/2');
  });
});
