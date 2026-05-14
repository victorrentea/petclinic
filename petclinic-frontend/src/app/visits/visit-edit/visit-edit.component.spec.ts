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
import {VetService} from '../../vets/vet.service';
import {Vet} from '../../vets/vet';
import {Owner} from '../../owners/owner';

class VisitServiceStub {
  getVisitById(visitId: string): Observable<Visit> {
    return of();
  }

  updateVisit(visitId: string, visit: Visit): Observable<Visit> {
    return of(visit);
  }
}

class OwnerServiceStub {
  getOwnerById(ownerId: string): Observable<Owner> {
    return of();
  }
}

class PetServiceStub {
  getPetById(petId: string): Observable<Pet> {
    return of();
  }
}

class VetServiceStub {
  getVets(): Observable<Vet[]> {
    return of();
  }
}

describe('VisitEditComponent', () => {
  let component: VisitEditComponent;
  let fixture: ComponentFixture<VisitEditComponent>;
  let visitService: VisitService;
  let testVisit: Visit;
  let testPet: Pet;
  let owner: Owner;
  let vets: Vet[];
  let getVisitSpy: Spy;
  let getPetSpy: Spy;
  let getOwnerSpy: Spy;
  let getVetsSpy: Spy;
  let updateVisitSpy: Spy;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitEditComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule],
      providers: [
        {provide: VisitService, useClass: VisitServiceStub},
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: PetService, useClass: PetServiceStub},
        {provide: VetService, useClass: VetServiceStub},
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
    owner = testPet.owner;
    vets = [
    {id: 1, firstName: 'James', lastName: 'Carter', specialties: []},
    {id: 2, firstName: 'Helen', lastName: 'Leary', specialties: []}
    ];
    testVisit = {
    id: 1,
    date: '2016-09-07',
    description: '',
    pet: testPet,
    petId: testPet.id,
    vetId: 2,
    vetName: 'Helen Leary'
    };

    visitService = fixture.debugElement.injector.get(VisitService);
    getVisitSpy = spyOn(visitService, 'getVisitById')
    .and.returnValue(of(testVisit));
    updateVisitSpy = spyOn(visitService, 'updateVisit')
    .and.returnValue(of(testVisit));
    getPetSpy = spyOn(TestBed.inject(PetService), 'getPetById')
    .and.returnValue(of(testPet));
    getOwnerSpy = spyOn(TestBed.inject(OwnerService), 'getOwnerById')
    .and.returnValue(of(owner));
    getVetsSpy = spyOn(TestBed.inject(VetService), 'getVets')
    .and.returnValue(of(vets));

    fixture.detectChanges();
  });

  it('should create VisitEditComponent', () => {
    expect(component).toBeTruthy();
  });

  it('loads veterinarians and keeps current veterinarian selected', () => {
    expect(getVisitSpy).toHaveBeenCalled();
    expect(getPetSpy).toHaveBeenCalled();
    expect(getOwnerSpy).toHaveBeenCalled();
    expect(getVetsSpy).toHaveBeenCalled();
    expect(component.vets).toEqual(vets);
    expect(component.visit.vetId).toBe(2);
  });

  it('submits changed veterinarian', () => {
    component.visit.vetId = 1;

    component.onSubmit(component.visit);

    expect(updateVisitSpy).toHaveBeenCalled();
    expect(updateVisitSpy.calls.mostRecent().args[1].vetId).toBe(1);
  });
});
