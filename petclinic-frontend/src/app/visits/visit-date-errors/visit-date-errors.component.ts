import {Component, Input} from '@angular/core';
import {NgModel} from '@angular/forms';

@Component({
  selector: 'app-visit-date-errors',
  templateUrl: './visit-date-errors.component.html'
})
export class VisitDateErrorsComponent {
  @Input() date: NgModel;
  @Input() birthDate: string;
}
