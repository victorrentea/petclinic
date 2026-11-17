import {Component} from '@angular/core';
import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {FormsModule, NgForm} from '@angular/forms';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import * as moment from 'moment';
import {Pet} from '../../pets/pet';
import {VisitDateFieldComponent} from './visit-date-field.component';

@Component({
  template: `<form #form="ngForm"><app-visit-date-field [value]="date" [pet]="pet"></app-visit-date-field></form>`
})
class HostComponent {
  date = '2020-05-01';
  pet = {birthDate: '2015-03-04'} as Pet;
}

describe('VisitDateFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let field: VisitDateFieldComponent;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [HostComponent, VisitDateFieldComponent],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule]
    }).compileComponents();
  }));

  beforeEach(waitForAsync(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    field = fixture.debugElement.children[0].children[0].componentInstance;
    fixture.whenStable();
  }));

  it('cannot predate the pet', () => {
    expect(field.minDate.format('YYYY-MM-DD')).toBe('2015-03-04');
    expect(field.birthDate).toBe('2015-03-04');
  });

  it('cannot be more than one year ahead', () => {
    expect(field.maxDate.format('YYYY-MM-DD')).toBe(moment().add(1, 'year').format('YYYY-MM-DD'));
  });

  it('has no lower bound for a pet without a birth date', () => {
    field.pet = {} as Pet;
    expect(field.minDate).toBeNull();
  });

  it('registers as `date` on the enclosing form', waitForAsync(async () => {
    await fixture.whenStable();
    const form = fixture.debugElement.children[0].injector.get(NgForm);
    expect(form.value.date).toBeTruthy();
  }));
});
