import {Component, ViewChild} from '@angular/core';
import {ComponentFixture, TestBed, fakeAsync, tick, waitForAsync} from '@angular/core/testing';
import {CommonModule} from '@angular/common';
import {FormsModule, NgForm} from '@angular/forms';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatMomentDateModule, MomentDateAdapter} from '@angular/material-moment-adapter';
import {DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE} from '@angular/material/core';
import {MY_DATE_FORMATS} from '../visits.module';
import {VisitDateFieldComponent} from './visit-date-field.component';
import {Pet} from '../../pets/pet';

@Component({
  template: `
    <form #f="ngForm">
      <app-visit-date-field [pet]="pet" [value]="value"></app-visit-date-field>
    </form>`
})
class HostComponent {
  @ViewChild(VisitDateFieldComponent) field: VisitDateFieldComponent;
  pet: Pet = {birthDate: '2018-08-06'} as Pet;
  value = '2026-05-12';
}

describe('VisitDateFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const input = () => fixture.debugElement.query(By.css('input[name="date"]')).nativeElement as HTMLInputElement;
  const form = () => fixture.debugElement.query(By.css('form')).injector.get(NgForm);
  const dateControl = () => form().controls['date'];
  const messages = () =>
    fixture.debugElement.queryAll(By.css('.help-block')).map(e => e.nativeElement.textContent.trim()).join(' ');

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, NoopAnimationsModule, MatDatepickerModule, MatMomentDateModule],
      declarations: [HostComponent, VisitDateFieldComponent],
      providers: [
        {provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE]},
        {provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS},
      ],
    }).compileComponents();
  }));

  beforeEach(fakeAsync(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    tick();
  }));

  it('registers "date" as a control of the surrounding form', fakeAsync(() => {
    expect(dateControl()).toBeDefined();
  }));

  it('labels the input, so the field is reachable by its label', () => {
    const label = fixture.debugElement.query(By.css('label')).nativeElement as HTMLLabelElement;

    expect(label.getAttribute('for')).toBe('date');
    expect(input().id).toBe('date');
  });

  it('offers the pet birth date as the earliest bookable day', () => {
    expect(host.field.minVisitDate).toEqual(new Date(2018, 7, 6));
  });

  it('offers one year out as the latest bookable day', () => {
    expect(host.field.maxVisitDate.getFullYear()).toBe(new Date().getFullYear() + 1);
  });

  it('has no bound below when the pet birth date is unknown', () => {
    host.pet = {} as Pet;
    fixture.detectChanges();

    expect(host.field.minVisitDate).toBeNull();
  });

  it('rejects — and explains — a date from before the pet was born', fakeAsync(() => {
    setDate('0009/07/20');

    expect(dateControl().hasError('matDatepickerMin')).toBeTrue();
    expect(messages()).toContain("between the pet's birth date and one year from now");
  }));

  it('rejects a date past one year out', fakeAsync(() => {
    const farOut = new Date();
    farOut.setFullYear(farOut.getFullYear() + 2);
    setDate(format(farOut));

    expect(dateControl().hasError('matDatepickerMax')).toBeTrue();
  }));

  it('accepts a date inside the range', fakeAsync(() => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    setDate(format(soon));

    expect(dateControl().valid).toBeTrue();
  }));

  /** MY_DATE_FORMATS parses YYYY/MM/DD, which is what the user actually types. */
  function format(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  }

  function setDate(value: string): void {
    const element = input();
    element.value = value;
    element.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    tick();
  }
});
