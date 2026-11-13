import {Component, Input} from '@angular/core';
import {NgModel} from '@angular/forms';
import * as moment from 'moment';

/** Why a visit date is outside the range the datepicker allows (issue #40). */
@Component({
  selector: 'app-visit-date-errors',
  template: `
    <ng-container *ngIf="date.dirty">
      <span class="help-block" *ngIf="date.hasError('matDatepickerMin')">
        A visit cannot predate the pet, born {{ birthDate }}
      </span>
      <span class="help-block" *ngIf="date.hasError('matDatepickerMax')">
        A visit cannot be booked after {{ maxDate.format('YYYY-MM-DD') }}, one year from today
      </span>
    </ng-container>`
})
export class VisitDateErrorsComponent {
  @Input() date: NgModel;
  @Input() birthDate: string;
  @Input() maxDate: moment.Moment;
}
