import {Component, Input} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';
import * as moment from 'moment';

// The "date" control registers on the enclosing <form>, so the host's visitForm.value.date keeps working.
@Component({
  selector: 'app-visit-date-field',
  templateUrl: './visit-date-field.component.html',
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}]
})
export class VisitDateFieldComponent {
  @Input() date: string;
  @Input() petBirthDate: string;
  // Mirrors the backend rule (Visit.requireDateWithinRange): from the pet's birth to one year ahead.
  readonly maxVisitDate = moment().startOf('day').add(1, 'year');
}
