/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';

import {VisitEditComponent} from './visit-edit.component';
import {FormsModule} from '@angular/forms';
import {VisitService} from '../visit.service';
import {ActivatedRoute, Router} from '@angular/router';
import {ActivatedRouteStub, RouterStub} from '../../testing/router-stubs';
import {Visit} from '../visit';
import {Observable, of} from 'rxjs';
import {Pet} from '../../pets/pet';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import { MatDatepickerModule } from '@angular/material/datepicker';
import Spy = jasmine.Spy;
import {OwnerService} from '../../owners/owner.service';
import {PetService} from '../../pets/pet.service';

const visitEditOwner = { id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023', pets: [] };

class VisitServiceStub {
  getVisitById(visitId: string): Observable<Visit> {
    return of();
  }
  updateVisit(visitId: string, visit: Visit): Observable<Visit> {
    return of(visit);
  }
}

class OwnerServiceStub {
  getOwnerById(): Observable<any> {
    return of(visitEditOwner);
  }
}

class PetServiceStub {
  getPetById(petId: string): Observable<Pet> {
    return of();
  }
}

describe('VisitEditComponent', () => {
  let component: VisitEditComponent;
  let fixture: ComponentFixture<VisitEditComponent>;
  let visitService: VisitService;
  let testVisit: Visit;
  let testPet: Pet;
  let spy: Spy;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitEditComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule],
      providers: [
        {provide: VisitService, useClass: VisitServiceStub},
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: PetService, useClass: PetServiceStub},
        {provide: Router, useClass: RouterStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitEditComponent);
    component = fixture.componentInstance;
    testPet = {
      id: 1,
      ownerId: 1,
      name: 'Leo',
      birthDate: '2010-09-07',
      type: {id: 1, name: 'cat'},
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
    testVisit = {
      id: 1,
      date: '2016-09-07',
      description: '',
      pet: testPet
    };

    visitService = fixture.debugElement.injector.get(VisitService);
    spy = spyOn(visitService, 'getVisitById')
      .and.returnValue(of(testVisit));

    fixture.detectChanges();
  });

  it('should create VisitEditComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should submit visit and navigate to owner detail', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.currentOwner = visitEditOwner as any;
    component.currentPet = testPet;
    const visit: Visit = { id: 1, date: '2023-05-01', description: 'updated', pet: testPet };
    component.onSubmit(visit);
    expect(router.navigate).toHaveBeenCalledWith(['/owners', 1]);
  });

  it('should navigate to owner detail via gotoOwnerDetail', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.currentOwner = visitEditOwner as any;
    component.gotoOwnerDetail();
    expect(router.navigate).toHaveBeenCalledWith(['/owners', 1]);
  });
});
