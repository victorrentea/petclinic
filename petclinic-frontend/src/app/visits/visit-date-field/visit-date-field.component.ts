import {Component, Input} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';
import {VisitDateRange} from '../visit-date-range';

/** The visit date input, shared by the add and edit forms; its control joins the enclosing form as "date". */
@Component({
  selector: 'app-visit-date-field',
  templateUrl: './visit-date-field.component.html',
  styles: [':host { display: block; }'],
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}]
})
export class VisitDateFieldComponent {
  @Input() visitDate: string;
  dateRange = new VisitDateRange();

  @Input() set petBirthDate(birthDate: string) {
    if (birthDate) {
      this.dateRange.forPetBornOn(birthDate);
    }
  }
}
