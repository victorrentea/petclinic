import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {Observable, of} from 'rxjs';
import {RouterTestingModule} from '@angular/router/testing';
import {Router} from '@angular/router';
import {CommonModule} from '@angular/common';
import {By} from '@angular/platform-browser';

import {VisitsPageComponent} from './visits-page.component';
import {VisitService} from '../visit.service';
import {Visit} from '../visit';

class VisitServiceStub {
  getVisits(): Observable<Visit[]> {
    return of();
  }
}

describe('VisitsPageComponent', () => {
  let component: VisitsPageComponent;
  let fixture: ComponentFixture<VisitsPageComponent>;
  let visitService: VisitServiceStub;

  const visits: Visit[] = [
    {
      id: 1, date: '2024-01-15', description: 'rabies shot', pet: null as any,
      petId: 7, petName: 'Leo', ownerId: 1, ownerFirstName: 'George', ownerLastName: 'Franklin',
    },
    {
      id: 2, date: '2025-06-04', description: 'checkup', pet: null as any,
      petId: 8, petName: 'Basil', ownerId: 2, ownerFirstName: 'Betty', ownerLastName: 'Davis',
    },
    {
      id: 3, date: '2023-09-10', description: 'spayed', pet: null as any,
      petId: 7, petName: 'Leo', ownerId: 1, ownerFirstName: 'George', ownerLastName: 'Franklin',
    },
  ];

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

  it('loads and sorts visits descending by date', waitForAsync(() => {
    spyOn(visitService, 'getVisits').and.returnValue(of(visits));
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      const dates = component.visits.map(v => v.date);
      expect(dates).toEqual(['2025-06-04', '2024-01-15', '2023-09-10']);
    });
  }));

  it('shows "No visits found." when service returns empty list', waitForAsync(() => {
    spyOn(visitService, 'getVisits').and.returnValue(of([]));
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const empty = fixture.debugElement.query(By.css('.no-visits'));
      expect(empty.nativeElement.textContent).toContain('No visits found.');
    });
  }));

  it('navigates to /visits/add when Add Visit clicked', () => {
    spyOn(visitService, 'getVisits').and.returnValue(of(visits));
    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate');
    fixture.detectChanges();

    component.addVisit();

    expect(navSpy).toHaveBeenCalledWith(['/visits/add']);
  });

  it('renders owner cell as a link to /owners/{ownerId}', waitForAsync(() => {
    spyOn(visitService, 'getVisits').and.returnValue(of(visits));
    fixture.detectChanges();
    fixture.whenStable().then(() => {
      fixture.detectChanges();
      const links = fixture.debugElement.queryAll(By.css('a.owner-link'));
      expect(links.length).toBe(visits.length);
      expect(links[0].attributes['ng-reflect-router-link'] || links[0].nativeElement.getAttribute('href'))
        .toContain('/owners/');
    });
  }));
});
