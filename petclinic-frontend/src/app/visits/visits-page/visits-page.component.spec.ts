import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {Observable, of, throwError} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {CommonModule} from '@angular/common';
import {By} from '@angular/platform-browser';

import {VisitsPageComponent} from './visits-page.component';
import {VisitService} from '../visit.service';
import {VisitPage, VisitRow} from '../visit';

class VisitServiceStub {
  getVisitPage(page: number, size: number, sort?: string, direction?: string): Observable<VisitPage> {
    return of();
  }
}

describe('VisitsPageComponent', () => {
  let component: VisitsPageComponent;
  let fixture: ComponentFixture<VisitsPageComponent>;
  let visitService: VisitServiceStub;

  const visits: VisitRow[] = [
    {id: 2, date: '2025-06-04', description: 'checkup', petName: 'Basil',
      ownerId: 2, ownerFirstName: 'Betty', ownerLastName: 'Davis'},
    {id: 1, date: '2024-01-15', description: 'rabies shot', petName: 'Leo',
      ownerId: 1, ownerFirstName: 'George', ownerLastName: 'Franklin'},
  ];
  const pageOf = (content: VisitRow[], totalElements = content.length): VisitPage =>
    ({content, page: {number: 0, size: 10, totalElements, totalPages: 1}});

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitsPageComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [CommonModule, RouterTestingModule],
      providers: [{provide: VisitService, useClass: VisitServiceStub}],
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

  it('first asks for 10 visits in the server\'s default order', () => {
    const spy = spyOn(visitService, 'getVisitPage').and.returnValue(of(pageOf(visits, 23)));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledOnceWith(0, 10, '', undefined);
    expect(component.visits).toEqual(visits);
    expect(component.totalVisits).toBe(23);
  });

  it('asks for the first page sorted by the clicked column', () => {
    const spy = spyOn(visitService, 'getVisitPage').and.returnValue(of(pageOf(visits)));
    fixture.detectChanges();
    component.onPage({pageIndex: 2, pageSize: 5, length: 23});

    component.onSort({active: 'owner', direction: 'desc'});

    expect(spy).toHaveBeenCalledWith(0, 5, 'owner', 'desc');
  });

  it('asks for the default order again once the sort is cleared', () => {
    const spy = spyOn(visitService, 'getVisitPage').and.returnValue(of(pageOf(visits)));
    fixture.detectChanges();

    component.onSort({active: 'owner', direction: ''});

    expect(spy).toHaveBeenCalledWith(0, 10, 'owner', undefined);
  });

  it('asks for the page and size picked in the paginator', () => {
    const spy = spyOn(visitService, 'getVisitPage').and.returnValue(of(pageOf(visits)));
    fixture.detectChanges();

    component.onPage({pageIndex: 1, pageSize: 20, length: 23});

    expect(spy).toHaveBeenCalledWith(1, 20, '', undefined);
  });

  it('keeps the shown page after a failed load, and still answers the next click', () => {
    const spy = spyOn(visitService, 'getVisitPage').and.returnValues(
      of(pageOf(visits, 23)), throwError(() => 'server returned code 500'), of(pageOf([visits[1]], 23)));
    fixture.detectChanges();

    component.onSort({active: 'pet', direction: 'asc'});
    expect(component.visits).toEqual(visits);

    component.onSort({active: 'pet', direction: 'desc'});
    expect(spy).toHaveBeenCalledTimes(3);
    expect(component.visits).toEqual([visits[1]]);
  });

  it('shows "No visits found." when there are none', () => {
    spyOn(visitService, 'getVisitPage').and.returnValue(of(pageOf([])));
    fixture.detectChanges();

    const empty = fixture.debugElement.query(By.css('.no-visits'));
    expect(empty.nativeElement.textContent).toContain('No visits found.');
  });

  it('renders owner cell as a link to /owners/{ownerId}', () => {
    spyOn(visitService, 'getVisitPage').and.returnValue(of(pageOf(visits)));
    fixture.detectChanges();

    const links = fixture.debugElement.queryAll(By.css('a.owner-link'));
    expect(links.length).toBe(visits.length);
    expect(links[0].nativeElement.getAttribute('href')).toBe('/owners/2');
  });
});
