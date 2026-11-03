import {Component, ViewChild} from '@angular/core';
import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {FormsModule, NgForm} from '@angular/forms';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {By} from '@angular/platform-browser';
import {VisitDateFieldComponent} from './visit-date-field.component';
import {visitDateRange} from '../visit-date-range';
import {MY_DATE_FORMATS} from '../visits.module';
import {MAT_DATE_FORMATS} from '@angular/material/core';

@Component({
  template: `
    <form #form="ngForm">
      <app-visit-date-field [visitDate]="visitDate" [dateRange]="dateRange"></app-visit-date-field>
    </form>`
})
class HostFormComponent {
  @ViewChild('form', {static: true}) form: NgForm;
  visitDate = '2024-03-10';
  dateRange = visitDateRange('2024-01-01');
}

describe('VisitDateFieldComponent', () => {
  let fixture: ComponentFixture<HostFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [HostFormComponent, VisitDateFieldComponent],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule, NoopAnimationsModule],
      providers: [{provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS}]
    });
    fixture = TestBed.createComponent(HostFormComponent);
  });

  function typeDate(text: string) {
    const input: HTMLInputElement = fixture.debugElement.query(By.css('input[name=date]')).nativeElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    tick();
    fixture.detectChanges();
  }

  it('registers the date as a control of the host form', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(fixture.componentInstance.form.value.date).toBe('2024-03-10');
  }));

  it('rejects a date before the pet was born', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    typeDate('2023/12/31');
    expect(fixture.componentInstance.form.valid).toBeFalse();
    expect(fixture.nativeElement.textContent)
      .toContain("Visit date cannot be before the pet's birth date (2024-01-01).");
  }));
});
