import {Component, Input} from '@angular/core';
import {NgModel} from '@angular/forms';

/** Why a visit date is out of range (#40): the datepicker's own min/max errors, worded for the user. */
@Component({
  selector: 'app-visit-date-errors',
  templateUrl: './visit-date-errors.component.html'
})
export class VisitDateErrorsComponent {
  @Input() control: NgModel;
  @Input() birthDate: string;
}
