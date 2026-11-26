import {Component, Input} from '@angular/core';
import {NgModel} from '@angular/forms';
import * as moment from 'moment';

@Component({
  selector: 'app-visit-date-errors',
  templateUrl: './visit-date-errors.component.html'
})
export class VisitDateErrorsComponent {
  @Input() ctrl: NgModel;
  @Input() minDate: moment.Moment;
  @Input() maxDate: moment.Moment;
}
