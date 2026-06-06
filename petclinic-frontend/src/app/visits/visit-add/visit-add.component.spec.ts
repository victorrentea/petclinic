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
import {Observable, of} from 'rxjs';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import { MatDatepickerModule } from '@angular/material/datepicker';
import Spy = jasmine.Spy;
import {OwnerService} from '../../owners/owner.service';
import {Owner} from '../../owners/owner';
import {VetService} from '../../vets/vet.service';
import {Vet} from '../../vets/vet';

class PetServiceStub {
  addPet(pet: Pet): Observable<Pet> {
    return of();
  }
  getPetById(petId: string): Observable<Pet> {
    return of();
  }
}

const visitOwner: Owner = { id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023', pets: [] };

const testVets: Vet[] = [
  { id: 1, firstName: 'James', lastName: 'Carter', specialties: [] },
  { id: 2, firstName: 'Helen', lastName: 'Leary', specialties: [] }
];

class OwnerServiceStub {
  getOwnerById(): Observable<Owner> {
    return of(visitOwner);
  }
}

class VetServiceStub {
  getVets(): Observable<Vet[]> {
    return of(testVets);
  }
}

class VisitServiceStub {
  addVisit(visit: any): Observable<any> {
    return of(visit);
  }
}

describe('VisitAddComponent', () => {
  let component: VisitAddComponent;
  let fixture: ComponentFixture<VisitAddComponent>;
  let petService: PetService;
  let visitService: VisitService;
  let testPet: Pet;
  let spy: Spy;

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
    petService = fixture.debugElement.injector.get(PetService);
    visitService = fixture.debugElement.injector.get(VisitService);
    spy = spyOn(petService, 'addPet')
      .and.returnValue(of(testPet));

    fixture.detectChanges();
  });

  it('should create VisitAddComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should load vets on init for the dropdown', () => {
    expect(component.vets).toEqual(testVets);
  });

  it('should submit visit and navigate to owner detail', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.currentOwner = visitOwner;
    component.currentPet = testPet;
    const visit: any = { id: null, date: '2023-05-01', description: 'checkup', vetId: 2, pet: testPet };
    const addSpy = spyOn(visitService, 'addVisit').and.callThrough();
    component.onSubmit(visit);
    expect(visit.id).toBeNull();
    expect(addSpy.calls.mostRecent().args[0].vetId).toBe(2);
    expect(component.addedSuccess).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/owners', 1]);
  });

  it('should navigate to owner detail via gotoOwnerDetail', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.currentOwner = visitOwner;
    component.gotoOwnerDetail();
    expect(router.navigate).toHaveBeenCalledWith(['/owners', 1]);
  });
});

describe('VisitAddComponent without pet in route', () => {
  let component: VisitAddComponent;
  let fixture: ComponentFixture<VisitAddComponent>;

  const leo: Pet = {
    id: 7,
    name: 'Leo',
    birthDate: '2010-09-07',
    type: {id: 1, name: 'cat'},
    ownerId: 1,
    owner: null,
    visits: []
  };

  class NoPetRouteStub {
    params = of({});
    get snapshot() {
      return {params: {}};
    }
  }

  class PetListServiceStub {
    getPets(): Observable<Pet[]> {
      return of([leo]);
    }
    getPetById(petId: number): Observable<Pet> {
      return of();
    }
  }

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitAddComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule],
      providers: [
        {provide: PetService, useClass: PetListServiceStub},
        {provide: VisitService, useClass: VisitServiceStub},
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: VetService, useClass: VetServiceStub},
        {provide: Router, useClass: RouterStub},
        {provide: ActivatedRoute, useClass: NoPetRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads all pets for the required pet dropdown', () => {
    expect(component.needsPetSelection).toBeTrue();
    expect(component.pets).toEqual([leo]);
  });

  it('selecting a pet wires it into the visit and loads its owner', () => {
    component.onPetSelected(7);
    expect(component.currentPet).toBe(leo);
    expect(component.visit.pet).toBe(leo);
    expect(component.currentPetType).toEqual({id: 1, name: 'cat'});
    expect(component.currentOwner).toEqual(visitOwner);
  });
});
