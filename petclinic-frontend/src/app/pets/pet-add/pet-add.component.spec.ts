/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';

import {PetAddComponent} from './pet-add.component';
import {FormsModule} from '@angular/forms';
import {PetService} from '../pet.service';
import {ActivatedRoute, Router} from '@angular/router';
import {ActivatedRouteStub, RouterStub} from '../../testing/router-stubs';
import {Observable, of} from 'rxjs';
import {Pet} from '../pet';
import {OwnerService} from '../../owners/owner.service';
import {PetTypeService} from '../../pettypes/pettype.service';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {Owner} from '../../owners/owner';
import {PetType} from '../../pettypes/pettype';
import Spy = jasmine.Spy;

const testOwner: Owner = { id: 1, firstName: 'George', lastName: 'Franklin', address: '110 W. Liberty St.', city: 'Madison', telephone: '6085551023', pets: [] };

class OwnerServiceStub {
  getOwnerById(): Observable<Owner> {
    return of(testOwner);
  }
}

class PetServiceStub {
  getPetById(petId: string): Observable<Pet> {
    return of();
  }
  addPet(pet: Pet): Observable<Pet> {
    return of(pet);
  }
}

class PetTypeServiceStub {
  getPetTypes(): Observable<PetType[]> {
    return of();
  }
}

describe('PetAddComponent', () => {
  let component: PetAddComponent;
  let fixture: ComponentFixture<PetAddComponent>;
  let petService: PetService;
  let testPet: Pet;
  let spy: Spy;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PetAddComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule],
      providers: [
        {provide: PetService, useClass: PetServiceStub},
        {provide: OwnerService, useClass: OwnerServiceStub},
        {provide: PetTypeService, useClass: PetTypeServiceStub},
        {provide: Router, useClass: RouterStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PetAddComponent);
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
    spy = spyOn(petService, 'getPetById')
      .and.returnValue(of(testPet));

    fixture.detectChanges();
  });

  it('should create PetAddComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should submit pet and navigate to owner detail', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.currentOwner = testOwner;
    const pet: Pet = { id: null, name: 'Basil', birthDate: '2020-01-15', type: { id: 1, name: 'cat' }, ownerId: 1, owner: testOwner, visits: [] };
    component.onSubmit(pet);
    expect(pet.id).toBeNull();
    expect(component.addedSuccess).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/owners', 1]);
  });

  it('should navigate to owner detail via gotoOwnerDetail', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.currentOwner = testOwner;
    component.gotoOwnerDetail();
    expect(router.navigate).toHaveBeenCalledWith(['/owners', 1]);
  });
});
