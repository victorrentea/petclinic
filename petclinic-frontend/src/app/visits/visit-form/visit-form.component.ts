import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Visit} from '../visit';
import * as moment from 'moment';

/** The date + description form shared by New Visit and Edit Visit. */
@Component({
  selector: 'app-visit-form',
  templateUrl: './visit-form.component.html'
})
export class VisitFormComponent {
  @Input() visit: Visit;
  /** #40: a visit is dated between the pet's birth and one year from today. */
  @Input() minDate: moment.Moment;
  @Input() maxDate: moment.Moment;
  @Input() submitLabel: string;
  @Output() submitted = new EventEmitter<Visit>();
  @Output() back = new EventEmitter<void>();
}
