import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NgModel} from '@angular/forms';
import {VisitDateErrorsComponent} from './visit-date-errors.component';

describe('VisitDateErrorsComponent', () => {
  let fixture: ComponentFixture<VisitDateErrorsComponent>;

  function render(error: string | null): string {
    fixture.componentInstance.control = {hasError: (e: string) => e === error} as NgModel;
    fixture.componentInstance.birthDate = '2020-03-01';
    fixture.detectChanges();
    return fixture.nativeElement.textContent.trim();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({declarations: [VisitDateErrorsComponent]});
    fixture = TestBed.createComponent(VisitDateErrorsComponent);
  });

  it('says a date before birth is refused, naming the birth date', () => {
    expect(render('matDatepickerMin')).toBe(`Visit date cannot be before the pet's birth date (2020-03-01)`);
  });

  it('says a date more than a year ahead is refused', () => {
    expect(render('matDatepickerMax')).toBe('Visit date cannot be more than one year from today');
  });

  it('says nothing for a date in range', () => {
    expect(render(null)).toBe('');
  });
});
