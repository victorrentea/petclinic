import {Component, Input} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';

import * as moment from 'moment';

/**
 * The Date field shared by the New Visit and Edit Visit forms, including the
 * [pet birth date .. +1 year] bounds from issue #40.
 *
 * `viewProviders` hands the child the parent's NgForm, so the inner `name="date"`
 * control registers there: the parent still reads `visitForm.value.date` and its
 * submit button still tracks `visitForm.valid`.
 */
@Component({
  selector: 'app-visit-date-field',
  templateUrl: './visit-date-field.component.html',
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}]
})
export class VisitDateFieldComponent {

  @Input() value: string;
  @Input() petBirthDate: string;

  /** A visit cannot predate the pet it belongs to. */
  get minDate(): Date | null {
    return this.petBirthDate ? new Date(this.petBirthDate) : null;
  }

  /** Booking further ahead than a year is a typo, not a plan. */
  get maxDate(): Date {
    return moment().add(1, 'year').toDate();
  }
}
