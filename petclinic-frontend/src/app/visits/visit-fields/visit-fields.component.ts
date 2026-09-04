import {Component, Input, OnChanges} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';
import * as moment from 'moment';
import {Visit} from '../visit';

/**
 * The date + description fields of a visit, which New Visit and Edit Visit used to
 * carry as two copies of the same markup. `viewProviders` hands the controls to the
 * surrounding NgForm, so the parent's `visitForm.value` still yields
 * {date, description} and its submit button still disables on an invalid date.
 *
 * Bug #40's bounds live here: a visit can neither predate the pet nor be booked more
 * than a year ahead.
 */
@Component({
  selector: 'app-visit-fields',
  templateUrl: './visit-fields.component.html',
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}]
})
export class VisitFieldsComponent implements OnChanges {
  @Input() visit: Visit;
  @Input() petBirthDate: string;

  minDate: moment.Moment;
  readonly maxDate = moment().add(1, 'year');

  ngOnChanges() {
    if (this.petBirthDate) {
      this.minDate = moment(this.petBirthDate);
    } else {
      this.minDate = null;
    }
  }
}
