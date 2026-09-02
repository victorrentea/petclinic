import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import {PettypeEditComponent} from './pettype-edit.component';
import {PetTypeService} from '../pettype.service';
import {PetType} from '../pettype';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {ActivatedRouteStub, RouterStub} from '../../testing/router-stubs';
import {FormsModule} from '@angular/forms';
import {Observable, of} from 'rxjs/index';
import Spy = jasmine.Spy;

class PetTypeServiceStub {
  getPetTypeById(typeId: string): Observable<PetType> {
    return of();
  }
  updatePetType(typeId: string, pettype: PetType): Observable<PetType> {
    return of(pettype);
  }
}


describe('PettypeEditComponent', () => {
  let component: PettypeEditComponent;
  let fixture: ComponentFixture<PettypeEditComponent>;
  let pettypeService: PetTypeService;
  let spy: Spy;
  let testPettype: PetType;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PettypeEditComponent ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule],
      providers: [
        {provide: PetTypeService, useClass: PetTypeServiceStub},
        {provide: Router, useClass: RouterStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PettypeEditComponent);
    component = fixture.componentInstance;
    testPettype = {
      id: 1,
      name: 'test'
    };

    pettypeService = fixture.debugElement.injector.get(PetTypeService);
    spy = spyOn(pettypeService, 'getPetTypeById')
      .and.returnValue(of(testPettype));

    fixture.detectChanges();
  });

  it('should create PettypeEditComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should submit and navigate back', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    const pettype: PetType = { id: 1, name: 'updated' };
    component.onSubmit(pettype);
    expect(router.navigate).toHaveBeenCalledWith(['/pettypes']);
  });

  it('should navigate back via onBack', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.onBack();
    expect(router.navigate).toHaveBeenCalledWith(['/pettypes']);
  });
});
