import {Component, Input} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';

import * as moment from 'moment';

@Component({
  selector: 'app-visit-date-field',
  templateUrl: './visit-date-field.component.html'
  ,
  // The field must register itself in the surrounding <form #visitForm="ngForm">, or the
  // submit button's [disabled]="!visitForm.valid" would never see it and the parent's
  // visitForm.value would lose the date.
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}]
})
export class VisitDateFieldComponent {
  @Input() value: string;
  // Issue #40: a visit belongs between the pet's birth date and a year from now.
  @Input() min: moment.Moment;
  @Input() max: moment.Moment;
  @Input() birthDate: string;
}
