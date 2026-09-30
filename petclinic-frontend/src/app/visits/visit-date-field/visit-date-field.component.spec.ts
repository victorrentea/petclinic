import {Component, ViewChild} from '@angular/core';
import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {FormsModule, NgForm} from '@angular/forms';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import * as moment from 'moment';

import {VisitDateFieldComponent} from './visit-date-field.component';

@Component({
  template: `
    <form #form="ngForm">
      <app-visit-date-field [visitDate]="visitDate" [petBirthDate]="petBirthDate"></app-visit-date-field>
    </form>`
})
class VisitFormHostComponent {
  @ViewChild(NgForm) form: NgForm;
  visitDate = '2020-05-01';
  petBirthDate = '2018-12-24';
}

describe('VisitDateFieldComponent', () => {
  let fixture: ComponentFixture<VisitFormHostComponent>;
  let host: VisitFormHostComponent;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitFormHostComponent, VisitDateFieldComponent],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule]
    }).compileComponents();
  }));

  beforeEach(waitForAsync(() => {
    fixture = TestBed.createComponent(VisitFormHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    fixture.whenStable().then(() => fixture.detectChanges());
  }));

  function enterDate(date: moment.Moment): void {
    const control = host.form.controls['date'];
    control.setValue(date);
    control.markAsDirty();
    fixture.detectChanges();
  }

  function errorShown(): string {
    return fixture.nativeElement.querySelector('.help-block')?.textContent ?? '';
  }

  it('joins the enclosing form as its "date" control', () => {
    expect(host.form.controls['date']).toBeDefined();
    expect(host.form.valid).toBeTrue();
  });

  it('refuses a date before the pet was born, naming the birth date', () => {
    enterDate(moment('2018-12-23'));

    expect(host.form.valid).toBeFalse();
    expect(errorShown()).toContain('A visit cannot predate the pet\'s birth (2018-12-24)');
  });

  it('accepts the pet\'s birthday', () => {
    enterDate(moment('2018-12-24'));

    expect(host.form.valid).toBeTrue();
  });

  it('refuses a date more than a year ahead, naming the last bookable day', () => {
    const lastBookableDay = moment().add(1, 'year');
    enterDate(lastBookableDay.clone().add(1, 'day'));

    expect(host.form.valid).toBeFalse();
    expect(errorShown()).toContain(
      'A visit cannot be booked more than a year ahead (' + lastBookableDay.format('YYYY-MM-DD') + ')');
  });

  it('puts no lower bound on the date until the pet\'s birth date is known', () => {
    const field = new VisitDateFieldComponent();
    field.petBirthDate = undefined;

    expect(field.dateRange.min).toBeNull();
  });
});
