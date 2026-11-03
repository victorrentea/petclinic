import {Component, Input} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';
import {VisitDateRange} from '../visit-date-range';

// viewProviders hands the host's NgForm to the inner ngModel, so `date` stays a control of the host form.
@Component({
  selector: 'app-visit-date-field',
  templateUrl: './visit-date-field.component.html',
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}]
})
export class VisitDateFieldComponent {
  @Input() visitDate: string;
  @Input() dateRange: VisitDateRange;
}
