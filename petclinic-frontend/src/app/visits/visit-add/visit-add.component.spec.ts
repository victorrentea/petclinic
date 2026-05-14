/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';

import {VisitAddComponent} from './visit-add.component';
import {FormsModule} from '@angular/forms';
import {VisitService} from '../visit.service';
import {PetService} from '../../pets/pet.service';
import {ActivatedRoute, Router} from '@angular/router';
import {ActivatedRouteStub, RouterStub} from '../../testing/router-stubs';
import {Pet} from '../../pets/pet';
import {Visit} from '../visit';
import {Observable, of} from 'rxjs';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import { MatDatepickerModule } from '@angular/material/datepicker';
import Spy = jasmine.Spy;
import {OwnerService} from '../../owners/owner.service';
import {VetService} from '../../vets/vet.service';
import {Vet} from '../../vets/vet';
import {Owner} from '../../owners/owner';

class PetServiceStub {
  getPetById(petId: string): Observable<Pet> {
    return of();
  }
}

class OwnerServiceStub {
  getOwnerById(ownerId: string): Observable<Owner> {
    return of();
  }
}

class VisitServiceStub {
  addVisit(): Observable<any> {
    return of();
  }
}

class VetServiceStub {
  getVets(): Observable<Vet[]> {
    return of();
  }
}

describe('VisitAddComponent', () => {
  let component: VisitAddComponent;
  let fixture: ComponentFixture<VisitAddComponent>;
  let petService: PetService;
  let visitService: VisitService;
  let ownerService: OwnerService;
  let vetService: VetService;
  let testPet: Pet;
  let addVisitSpy: Spy;
  let getPetSpy: Spy;
  let getOwnerSpy: Spy;
  let getVetsSpy: Spy;
  let owner: Owner;
  let vets: Vet[];

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitAddComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule],
      providers: [
        {provide: PetService, useClass: PetServiceStub},
        {provide: VisitService, useClass: VisitServiceStub},
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: VetService, useClass: VetServiceStub},
        {provide: Router, useClass: RouterStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitAddComponent);
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
    owner = testPet.owner;
    vets = [
      {id: 1, firstName: 'James', lastName: 'Carter', specialties: []},
      {id: 2, firstName: 'Helen', lastName: 'Leary', specialties: []}
    ];
    petService = fixture.debugElement.injector.get(PetService);
    visitService = fixture.debugElement.injector.get(VisitService);
    ownerService = fixture.debugElement.injector.get(OwnerService);
    vetService = fixture.debugElement.injector.get(VetService);
    getPetSpy = spyOn(petService, 'getPetById')
    .and.returnValue(of(testPet));
    getOwnerSpy = spyOn(ownerService, 'getOwnerById')
    .and.returnValue(of(owner));
    getVetsSpy = spyOn(vetService, 'getVets')
    .and.returnValue(of(vets));
    addVisitSpy = spyOn(visitService, 'addVisit')
    .and.returnValue(of({
      id: 11,
      date: '2026-05-10',
      description: 'checkup',
      pet: testPet,
      vetId: 2,
      vetName: 'Helen Leary'
    } as Visit));

    fixture.detectChanges();
  });

  it('should create VisitAddComponent', () => {
    expect(component).toBeTruthy();
  });

  it('loads veterinarians on init', () => {
    expect(getPetSpy).toHaveBeenCalled();
    expect(getOwnerSpy).toHaveBeenCalledWith(1 as any);
    expect(getVetsSpy).toHaveBeenCalled();
    expect(component.vets).toEqual(vets);
  });

  it('submits selected veterinarian', () => {
    component.visit = {pet: testPet, vetId: 2, date: '2026-05-10', description: 'checkup'} as any;

    component.onSubmit(component.visit);

    expect(addVisitSpy).toHaveBeenCalled();
    expect(addVisitSpy.calls.mostRecent().args[0].vetId).toBe(2);
  });
});
