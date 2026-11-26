import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Visit} from '../visit';
import * as moment from 'moment';

@Component({
  selector: 'app-visit-form',
  templateUrl: './visit-form.component.html'
})
export class VisitFormComponent {
  @Input() visit: Visit;
  @Input() minDate: moment.Moment;
  @Input() maxDate: moment.Moment;
  @Input() submitLabel: string;
  @Output() submitted = new EventEmitter<Visit>();
  @Output() back = new EventEmitter<void>();

  onSubmit(value: Visit) {
    this.submitted.emit(value);
  }
}
