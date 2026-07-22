/* tslint:disable:no-unused-variable */

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';

import {VetListComponent} from './vet-list.component';
import {FormsModule} from '@angular/forms';
import {VetService} from '../vet.service';
import {ActivatedRoute, Router} from '@angular/router';
import {ActivatedRouteStub, RouterStub} from '../../testing/router-stubs';
import {Vet} from '../vet';
import {Observable, of} from 'rxjs/index';

const vets: Vet[] = [
  { id: 1, firstName: 'James', lastName: 'Carter', specialties: [] },
  { id: 2, firstName: 'Helen', lastName: 'Leary', specialties: [] }
];

class VetServiceStub {
  getVets(): Observable<Vet[]> { return of(vets); }
  deleteVet(id: string): Observable<number> { return of(200); }
}

describe('VetListComponent', () => {
  let component: VetListComponent;
  let fixture: ComponentFixture<VetListComponent>;
  let vetService: VetService;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VetListComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule],
      providers: [
        {provide: VetService, useClass: VetServiceStub},
        {provide: Router, useClass: RouterStub},
        {provide: ActivatedRoute, useClass: ActivatedRouteStub}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VetListComponent);
    component = fixture.componentInstance;
    vetService = fixture.debugElement.injector.get(VetService);
    fixture.detectChanges();
  });

  it('should create and load vets', () => {
    expect(component).toBeTruthy();
    expect(component.vets).toEqual(vets);
    expect(component.isVetDataReceived).toBeTrue();
  });

  it('should delete vet from list', () => {
    component.vets = [...vets];
    component.deleteVet(vets[0]);
    expect(component.vets.length).toBe(1);
    expect(component.vets[0].id).toBe(2);
  });

  it('should navigate to home', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.gotoHome();
    expect(router.navigate).toHaveBeenCalledWith(['/welcome']);
  });

  it('should navigate to add vet', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.addVet();
    expect(router.navigate).toHaveBeenCalledWith(['/vets/add']);
  });

  it('should navigate to edit vet', () => {
    const router = fixture.debugElement.injector.get(Router) as unknown as RouterStub;
    spyOn(router, 'navigate');
    component.editVet(vets[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/vets', 1, 'edit']);
  });
});
