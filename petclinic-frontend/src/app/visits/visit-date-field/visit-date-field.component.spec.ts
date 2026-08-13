import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {FormsModule, NgForm} from '@angular/forms';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import {Component, ViewChild} from '@angular/core';

import {VisitDateFieldComponent} from './visit-date-field.component';

// The field only works inside a form — it reaches for the parent NgForm through
// viewProviders — so it is exercised through a host that provides one.
@Component({
  template: `
    <form #hostForm="ngForm">
      <app-visit-date-field [value]="value" [petBirthDate]="petBirthDate"></app-visit-date-field>
    </form>`
})
class HostComponent {
  @ViewChild('hostForm') hostForm: NgForm;
  @ViewChild(VisitDateFieldComponent) field: VisitDateFieldComponent;
  value = '2024-03-04';
  petBirthDate = '2019-09-04';
}

describe('VisitDateFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitDateFieldComponent, HostComponent],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(host.field).toBeTruthy();
  });

  it('lower-bounds the date at the pet birth date', () => {
    expect(host.field.minDate).toEqual(new Date('2019-09-04'));
  });

  it('has no lower bound while the pet has not loaded yet', () => {
    host.petBirthDate = undefined;
    fixture.detectChanges();

    expect(host.field.minDate).toBeNull();
  });

  it('upper-bounds the date one year from today', () => {
    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    expect(host.field.maxDate.toDateString()).toEqual(oneYearOut.toDateString());
  });

  // NgModel registers with the parent form in a microtask, so the control is not
  // there yet on the synchronous first change-detection pass.
  it('registers its control in the parent form under the name "date"', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.hostForm.controls.date).toBeTruthy();
  });

  it('renders the date input bound to the given value', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[name="date"]');

    expect(input).toBeTruthy();
    expect(input.id).toEqual('date');
  });
});
