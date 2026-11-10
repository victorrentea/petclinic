import {Component, Input} from '@angular/core';
import {NgModel} from '@angular/forms';
import {latestVisitDate} from '../visit-date-range';

/** The validation messages under a visit's date field, shared by the add and edit forms. */
@Component({
  selector: 'app-visit-date-errors',
  templateUrl: './visit-date-errors.component.html'
})
export class VisitDateErrorsComponent {
  @Input() date: NgModel;
  @Input() birthDate: string;
  readonly latestVisitDate = latestVisitDate();
}
