/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { PetListComponent } from './pet-list.component';
import { FormsModule } from '@angular/forms';
import { PetService } from '../pet.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivatedRouteStub, RouterStub } from '../../testing/router-stubs';
import { Pet } from '../pet';
import { Observable, of } from 'rxjs';
import Spy = jasmine.Spy;

class PetServiceStub {
  deletePet(petId: string): Observable<number> {
    return of();
  }
}

describe('PetListComponent', () => {
  let component: PetListComponent;
  let fixture: ComponentFixture<PetListComponent>;
  let inputPet: Pet;
  let petService: PetService;
  let spy: Spy;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [PetListComponent],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        imports: [FormsModule],
        providers: [
          { provide: PetService, useClass: PetServiceStub },
          { provide: Router, useClass: RouterStub },
          { provide: ActivatedRoute, useClass: ActivatedRouteStub },
        ],
      }).compileComponents();
    })
  );

  beforeEach(() => {
    fixture = TestBed.createComponent(PetListComponent);
    component = fixture.componentInstance;
    inputPet = {
      id: 1,
      name: 'Leo',
      birthDate: '2010-09-07',
      type: { id: 1, name: 'cat' },
      ownerId: 1,
      owner: {
        id: 1,
        firstName: 'George',
        lastName: 'Franklin',
        address: '110 W. Liberty St.',
        city: 'Madison',
        telephone: '6085551023',
        pets: null,
      },
      visits: null,
    };
    component.pet = inputPet;
    petService = fixture.debugElement.injector.get(PetService);
    spy = spyOn(petService, 'deletePet').and.returnValue(of(1));

    fixture.detectChanges();
  });

  it('should create PetListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call deletePet() method', () => {
    fixture.detectChanges();
    component.deletePet(component.pet);
    expect(spy.calls.any()).toBe(true, 'deletePet called');
  });
});
