import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NgModel} from '@angular/forms';

import {VisitDateErrorsComponent} from './visit-date-errors.component';

describe('VisitDateErrorsComponent', () => {
  let fixture: ComponentFixture<VisitDateErrorsComponent>;

  function render(dirty: boolean, errors: Record<string, unknown> | null): string {
    fixture.componentInstance.date = {dirty, hasError: (code: string) => !!errors?.[code]} as NgModel;
    fixture.componentInstance.birthDate = '2020-03-01';
    fixture.detectChanges();
    return fixture.nativeElement.textContent.trim();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({declarations: [VisitDateErrorsComponent]});
    fixture = TestBed.createComponent(VisitDateErrorsComponent);
  });

  it('says nothing before the user touches the date', () => {
    expect(render(false, {matDatepickerMin: true})).toBe('');
  });

  it('names the birth date when the date is before it', () => {
    expect(render(true, {matDatepickerMin: true})).toBe("Date must not be before the pet's birth date (2020-03-01)");
  });

  it('caps the date at one year ahead', () => {
    expect(render(true, {matDatepickerMax: true})).toBe('Date must be at most 1 year in the future');
  });

  it('flags an unparsable date', () => {
    expect(render(true, {matDatepickerParse: true})).toBe('Date is not a valid date');
  });

  it('flags a missing date', () => {
    expect(render(true, {required: true})).toBe('Date is required');
  });
});
