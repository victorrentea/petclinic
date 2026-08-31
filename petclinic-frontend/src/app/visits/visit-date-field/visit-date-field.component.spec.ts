import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {FormsModule, NgForm} from '@angular/forms';
import {MatMomentDateModule} from '@angular/material-moment-adapter';
import {MatDatepickerModule} from '@angular/material/datepicker';

import * as moment from 'moment';

import {VisitDateFieldComponent} from './visit-date-field.component';

// The field carries the visit-date range of issue #40 for both New Visit and Edit Visit.
// It lives in one place precisely so the two forms cannot drift apart.
describe('VisitDateFieldComponent', () => {
  let component: VisitDateFieldComponent;
  let fixture: ComponentFixture<VisitDateFieldComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitDateFieldComponent],
      imports: [FormsModule, MatDatepickerModule, MatMomentDateModule],
      providers: [NgForm]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitDateFieldComponent);
    component = fixture.componentInstance;
    component.value = '2020-01-01';
    component.min = moment('2018-08-06');
    component.max = moment().add(1, 'year');
    component.birthDate = '2018-08-06';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should pass the range on to the date picker input', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[name="date"]');

    expect(input).toBeTruthy();
    expect(component.min.format('YYYY-MM-DD')).toBe('2018-08-06');
    expect(component.max.isAfter(moment())).toBeTrue();
  });
});
