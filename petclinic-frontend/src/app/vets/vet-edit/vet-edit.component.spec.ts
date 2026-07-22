import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { VetEditComponent } from './vet-edit.component';
import { VetService } from '../vet.service';
import { SpecialtyService } from '../../specialties/specialty.service';
import { RouterStub } from '../../testing/router-stubs';
import { Router, ActivatedRoute } from '@angular/router';
import { Vet } from '../vet';
import { Specialty } from '../../specialties/specialty';

const specialties: Specialty[] = [{ id: 1, name: 'radiology' }];
const existingVet: Vet = { id: 1, firstName: 'James', lastName: 'Carter', specialties: [] };

class ActivatedRouteDataStub {
  snapshot = { data: { specs: specialties, vet: { ...existingVet, specialties: [] } } };
}

class VetServiceStub {
  updateVet(id: string, vet: Vet) { return of(vet); }
}

class SpecialtyServiceStub {
  getSpecialties() { return of(specialties); }
}

describe('VetEditComponent', () => {
  let component: VetEditComponent;
  let fixture: ComponentFixture<VetEditComponent>;
  let router: RouterStub;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VetEditComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [ReactiveFormsModule, MatSelectModule, NoopAnimationsModule],
      providers: [
        { provide: SpecialtyService, useClass: SpecialtyServiceStub },
        { provide: VetService, useClass: VetServiceStub },
        { provide: Router, useClass: RouterStub },
        { provide: ActivatedRoute, useClass: ActivatedRouteDataStub }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VetEditComponent);
    component = fixture.componentInstance;
    router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    fixture.detectChanges();
  });

  it('should create and populate form from route data', () => {
    expect(component).toBeTruthy();
    expect(component.firstNameCtrl.value).toBe(existingVet.firstName);
    expect(component.lastNameCtrl.value).toBe(existingVet.lastName);
  });

  it('compareSpecFn returns true for same id', () => {
    expect(component.compareSpecFn({ id: 1, name: 'a' }, { id: 1, name: 'b' })).toBeTrue();
  });

  it('compareSpecFn returns false for different ids', () => {
    expect(component.compareSpecFn({ id: 1, name: 'a' }, { id: 2, name: 'b' })).toBeFalse();
  });

  it('should submit and navigate to vet list', () => {
    spyOn(router, 'navigate');
    const vet: Vet = { id: 1, firstName: 'Updated', lastName: 'Name', specialties: [] };
    component.onSubmit(vet);
    expect(router.navigate).toHaveBeenCalledWith(['/vets']);
  });

  it('should navigate to vet list via gotoVetList', () => {
    spyOn(router, 'navigate');
    component.gotoVetList();
    expect(router.navigate).toHaveBeenCalledWith(['/vets']);
  });
});
