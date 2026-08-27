import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {FormsModule, NgForm} from '@angular/forms';
import * as moment from 'moment';

import {VisitDateFieldComponent} from './visit-date-field.component';
import {Pet} from '../../pets/pet';

// GitHub #40: the window this field allows. Asserted on the component rather than through the
// datepicker, because it is the boundary the two visit forms now share — if it drifts, both
// forms drift with it.
describe('VisitDateFieldComponent', () => {
  let component: VisitDateFieldComponent;
  let fixture: ComponentFixture<VisitDateFieldComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [VisitDateFieldComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      imports: [FormsModule],
      // The component asks for the surrounding form; standalone in a test there is none.
      providers: [NgForm],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisitDateFieldComponent);
    component = fixture.componentInstance;
  });

  it('floors the range at the pet\'s birth date', () => {
    component.pet = {birthDate: '2018-08-06'} as Pet;

    expect(component.minVisitDate?.format('YYYY-MM-DD')).toBe('2018-08-06');
  });

  it('leaves the range open below when the pet has no birth date on file', () => {
    component.pet = {} as Pet;

    expect(component.minVisitDate).toBeUndefined();
  });

  it('caps the range one year from today', () => {
    expect(component.maxVisitDate.format('YYYY-MM-DD'))
        .toBe(moment().add(1, 'year').format('YYYY-MM-DD'));
    expect(component.maxVisitDateLabel).toBe(moment().add(1, 'year').format('YYYY/MM/DD'));
  });
});
