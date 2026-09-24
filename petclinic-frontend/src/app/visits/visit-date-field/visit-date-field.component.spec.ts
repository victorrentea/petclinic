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
      <app-visit-date-field [visitDate]="visitDate" petBirthDate="2020-01-01"></app-visit-date-field>
    </form>`
})
class HostFormComponent {
  @ViewChild('form', {static: true}) form: NgForm;
  visitDate = '2024-05-06';
}

describe('VisitDateFieldComponent', () => {
  let fixture: ComponentFixture<HostFormComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [HostFormComponent, VisitDateFieldComponent],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule]
    }).compileComponents();
    fixture = TestBed.createComponent(HostFormComponent);
    fixture.detectChanges();
  }));

  it('contributes a date control to the host form', waitForAsync(() => {
    fixture.whenStable().then(() => {
      expect(fixture.componentInstance.form.value.date).toBe('2024-05-06');
    });
  }));

  it('caps the date one year ahead', () => {
    const field = fixture.debugElement.children[0].children[0].componentInstance as VisitDateFieldComponent;
    expect(field.maxVisitDate).toBe(moment().add(1, 'year').format('YYYY-MM-DD'));
  });
});
