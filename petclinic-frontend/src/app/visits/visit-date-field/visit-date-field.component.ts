import {Component, Input} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';
import * as moment from 'moment';
import {Pet} from '../../pets/pet';
import {earliestVisitDate, latestVisitDate} from '../visit-date-range';

/** The visit date input shared by Add and Edit Visit; registers as `date` on the enclosing form. */
@Component({
  selector: 'app-visit-date-field',
  templateUrl: './visit-date-field.component.html',
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}]
})
export class VisitDateFieldComponent {
  @Input() value: string;
  birthDate: string;
  minDate: moment.Moment | null = null;
  readonly maxDate = latestVisitDate();

  @Input() set pet(pet: Pet) {
    this.birthDate = pet?.birthDate;
    this.minDate = earliestVisitDate(pet);
  }
}
