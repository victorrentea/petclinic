/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';

import {VisitListComponent} from './visit-list.component';
import {FormsModule} from '@angular/forms';
import {VisitService} from '../visit.service';
import {ActivatedRoute, Router} from '@angular/router';
import {ActivatedRouteStub, RouterStub} from '../../testing/router-stubs';
import {Visit} from '../visit';
import {Pet} from '../../pets/pet';
import {Observable, of} from 'rxjs';
import Spy = jasmine.Spy;
import {By} from '@angular/platform-browser';

class VisitServiceStub {
  deleteVisit(visitId: string): Observable<number> {
    return of();
  }
}

describe('VisitListComponent', () => {
  let component: VisitListComponent;
  let fixture: ComponentFixture<VisitListComponent>;
  let visitService: VisitService;
  let testVisits: Visit[];
  let testPet: Pet;
  let spy: Spy;
  let responseStatus: number;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitListComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule],
      providers: [
        {provide: VisitService, useClass: VisitServiceStub},
        {provide: Router, useClass: RouterStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitListComponent);
    component = fixture.componentInstance;
    testPet = {
      id: 1,
      name: 'Leo',
      birthDate: '2010-09-07',
      type: {id: 1, name: 'cat'},
      ownerId: 1,
      owner: {
        id: 1,
        firstName: 'George',
        lastName: 'Franklin',
        address: '110 W. Liberty St.',
        city: 'Madison',
        telephone: '6085551023',
        pets: null
      },
      visits: null
    };
    testVisits =  [{
      id: 1,
      date: '2016-09-07',
      description: '',
      pet: testPet,
      vetName: 'James Carter'
    }, {
      id: 2,
      date: '2017-09-07',
      description: 'legacy',
      pet: testPet
    }];

    visitService = fixture.debugElement.injector.get(VisitService);
    responseStatus = 204; // success delete return NO_CONTENT
    component.visits = testVisits;

    spy = spyOn(visitService, 'deleteVisit')
      .and.returnValue(of(responseStatus));

    fixture.detectChanges();
  });

  it('should create VisitListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call deleteVisit() method', () => {
    fixture.detectChanges();
    component.deleteVisit(component.visits[0]);
    expect(spy.calls.any()).toBe(true, 'deleteVisit called');
  });

  it('renders veterinarian name and Unassigned fallback', () => {
    fixture.detectChanges();

    const vetCells = fixture.debugElement.queryAll(By.css('.visit-vet'));

    expect(vetCells[0].nativeElement.textContent).toContain('James Carter');
    expect(vetCells[1].nativeElement.textContent).toContain('Unassigned');
  });

  it('should render Add Visit button when petId is provided', () => {
    component.petId = 1;
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const addVisitButton = buttons.find(b => b.nativeElement.textContent.trim() === 'Add Visit');
    expect(addVisitButton).toBeTruthy('Add Visit button should be present');
  });

  it('should navigate to add visit route when Add Visit button is clicked', () => {
    const router = fixture.debugElement.injector.get(Router);
    const navigateSpy = spyOn(router, 'navigate');

    component.petId = 42;
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const addVisitButton = buttons.find(b => b.nativeElement.textContent.trim() === 'Add Visit');
    addVisitButton.nativeElement.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/pets', 42, 'visits', 'add']);
  });

});
