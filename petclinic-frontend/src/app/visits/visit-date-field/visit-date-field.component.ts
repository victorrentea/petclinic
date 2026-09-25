import {Component, Input} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';
import * as moment from 'moment';

@Component({
  selector: 'app-visit-date-field',
  templateUrl: './visit-date-field.component.html',
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}]
})
export class VisitDateFieldComponent {
  @Input() visitDate: string;
  @Input() petBirthDate: string;
  readonly maxVisitDate = moment().add(1, 'year').format('YYYY-MM-DD');
}
