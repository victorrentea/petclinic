/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';

import {VisitListComponent} from './visit-list.component';
import {VisitVetPipe} from '../visit-vet.pipe';
import {By} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {VisitService} from '../visit.service';
import {ActivatedRoute, Router} from '@angular/router';
import {ActivatedRouteStub, RouterStub} from '../../testing/router-stubs';
import {Visit} from '../visit';
import {Pet} from '../../pets/pet';
import {Observable, of} from 'rxjs';
import Spy = jasmine.Spy;

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
      declarations: [VisitListComponent, VisitVetPipe],
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
      pet: testPet
    }, {
      id: 2,
      date: '2017-01-01',
      description: 'checkup',
      pet: testPet,
      vetId: 2, vetFirstName: 'Helen', vetLastName: 'Leary'
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

  it('shows the vet of each visit, and "No vet" where there is none', () => {
    const cells = fixture.debugElement.queryAll(By.css('td.visit-vet'))
      .map(cell => cell.nativeElement.textContent.trim());
    expect(cells).toEqual(['No vet', 'Helen Leary']);
  });

  it('should call deleteVisit() method', () => {
    fixture.detectChanges();
    component.deleteVisit(component.visits[0]);
    expect(spy.calls.any()).toBe(true, 'deleteVisit called');
  });

});
