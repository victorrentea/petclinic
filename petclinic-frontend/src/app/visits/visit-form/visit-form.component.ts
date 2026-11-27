import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Visit} from '../visit';

/** The date + description form shared by New Visit and Edit Visit. */
@Component({
  selector: 'app-visit-form',
  templateUrl: './visit-form.component.html'
})
export class VisitFormComponent {
  @Input() visit: Visit;
  @Input() submitLabel: string;
  @Output() submitted = new EventEmitter<Visit>();
  @Output() back = new EventEmitter<void>();
}
