import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { VetAddComponent } from './vet-add.component';
import { VetService } from '../vet.service';
import { SpecialtyService } from '../../specialties/specialty.service';
import { RouterStub } from '../../testing/router-stubs';
import { Router } from '@angular/router';
import { Vet } from '../vet';
import { Specialty } from '../../specialties/specialty';

const specialties: Specialty[] = [{ id: 1, name: 'radiology' }, { id: 2, name: 'surgery' }];
const newVet: Vet = { id: 1, firstName: 'John', lastName: 'Doe', specialties: [] };

class SpecialtyServiceStub {
  getSpecialties() { return of(specialties); }
}

class VetServiceStub {
  addVet(vet: Vet) { return of(newVet); }
}

describe('VetAddComponent', () => {
  let component: VetAddComponent;
  let fixture: ComponentFixture<VetAddComponent>;
  let router: RouterStub;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VetAddComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule],
      providers: [
        { provide: SpecialtyService, useClass: SpecialtyServiceStub },
        { provide: VetService, useClass: VetServiceStub },
        { provide: Router, useClass: RouterStub }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VetAddComponent);
    component = fixture.componentInstance;
    router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    fixture.detectChanges();
  });

  it('should create and load specialties on init', () => {
    expect(component).toBeTruthy();
    expect(component.specialtiesList).toEqual(specialties);
  });

  it('should submit vet without specialty', () => {
    spyOn(router, 'navigate');
    const vet: Vet = { id: null, firstName: 'James', lastName: 'Carter', specialties: [] };
    component.onSubmit(vet);
    expect(vet.specialties).toEqual([]);
    expect(router.navigate).toHaveBeenCalledWith(['/vets']);
  });

  it('should submit vet with selected specialty', () => {
    spyOn(router, 'navigate');
    component.selectedSpecialty = specialties[0];
    const vet: Vet = { id: null, firstName: 'Helen', lastName: 'Leary', specialties: [] };
    component.onSubmit(vet);
    expect(vet.specialties).toContain(specialties[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/vets']);
  });

  it('should navigate to vet list', () => {
    spyOn(router, 'navigate');
    component.gotoVetList();
    expect(router.navigate).toHaveBeenCalledWith(['/vets']);
  });
});
