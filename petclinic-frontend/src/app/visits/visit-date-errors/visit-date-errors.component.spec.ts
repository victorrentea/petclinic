import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NgModel} from '@angular/forms';
import * as moment from 'moment';
import {VisitDateErrorsComponent} from './visit-date-errors.component';

describe('VisitDateErrorsComponent', () => {
  let fixture: ComponentFixture<VisitDateErrorsComponent>;

  function render(error: string | null, dirty = true): string {
    fixture = TestBed.configureTestingModule({declarations: [VisitDateErrorsComponent]})
      .createComponent(VisitDateErrorsComponent);
    fixture.componentInstance.date = {dirty, hasError: (code: string) => code === error} as unknown as NgModel;
    fixture.componentInstance.birthDate = '2024-05-10';
    fixture.componentInstance.maxDate = moment('2027-11-13');
    fixture.detectChanges();
    return fixture.nativeElement.textContent.trim();
  }

  it('says a visit cannot predate the pet', () => {
    expect(render('matDatepickerMin')).toBe('A visit cannot predate the pet, born 2024-05-10');
  });

  it('says a visit cannot be more than one year ahead', () => {
    expect(render('matDatepickerMax')).toBe('A visit cannot be booked after 2027-11-13, one year from today');
  });

  it('says nothing about a date not typed yet', () => {
    expect(render('matDatepickerMin', false)).toBe('');
  });
});
