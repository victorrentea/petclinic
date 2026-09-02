/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';

import {SpecialtyListComponent} from './specialty-list.component';
import {FormsModule} from '@angular/forms';
import {SpecialtyService} from '../specialty.service';
import {Specialty} from '../specialty';
import {ActivatedRoute, Router} from '@angular/router';
import {ActivatedRouteStub, RouterStub} from '../../testing/router-stubs';
import {Observable, of} from 'rxjs/index';
import Spy = jasmine.Spy;

class SpecialityServiceStub {
  deleteSpecialty(specId: string): Observable<number> {
    return of();
  }
  getSpecialties(): Observable<Specialty[]> {
    return of();
  }
}


describe('SpecialtyListComponent', () => {
  let component: SpecialtyListComponent;
  let fixture: ComponentFixture<SpecialtyListComponent>;
  let specialtyService: SpecialtyService;
  let spy: Spy;
  let testSpecialties: Specialty[];
  let responseStatus: number;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [SpecialtyListComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule],
      providers: [
        {provide: SpecialtyService, useClass: SpecialityServiceStub},
        {provide: Router, useClass: RouterStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SpecialtyListComponent);
    component = fixture.componentInstance;
    testSpecialties = [{
      id: 1,
      name: 'test'
    }];

    specialtyService = fixture.debugElement.injector.get(SpecialtyService);
    responseStatus = 204; // success delete return NO_CONTENT
    component.specialties = testSpecialties;

    spy = spyOn(specialtyService, 'deleteSpecialty')
      .and.returnValue(of(responseStatus));

    fixture.detectChanges();
  });

  it('should create SpecialtyListComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should call deleteSpecialty() method', () => {
    fixture.detectChanges();
    component.deleteSpecialty(component.specialties[0]);
    expect(spy.calls.any()).toBe(true, 'deleteSpecialty called');
  });

  it('should toggle isInsert on showAddSpecialtyComponent', () => {
    expect(component.isInsert).toBeFalse();
    component.showAddSpecialtyComponent();
    expect(component.isInsert).toBeTrue();
    component.showAddSpecialtyComponent();
    expect(component.isInsert).toBeFalse();
  });

  it('should add specialty and toggle isInsert on onNewSpecialty', () => {
    const newSpecialty: Specialty = { id: 2, name: 'dentistry' };
    const initialLength = component.specialties.length;
    component.onNewSpecialty(newSpecialty);
    expect(component.specialties.length).toBe(initialLength + 1);
    expect(component.isInsert).toBeTrue();
  });

  it('should navigate to edit specialty', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.showEditSpecialtyComponent(testSpecialties[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/specialties', '1', 'edit']);
  });

  it('should navigate to home', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.gotoHome();
    expect(router.navigate).toHaveBeenCalledWith(['/welcome']);
  });
});
