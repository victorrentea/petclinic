import {Component, Input} from '@angular/core';
import {NgModel} from '@angular/forms';

/**
 * Inline error messages for the visit date field's min/max bounds (bug #40). Shared by
 * visit-add and visit-edit so the wording stays in sync between the two forms.
 */
@Component({
  selector: 'app-visit-date-errors',
  template: `
    <span class="help-block" *ngIf="dateControl?.hasError('matDatepickerMin')">A visit cannot predate the pet's birth date ({{ minDate | date:'yyyy-MM-dd' }})</span>
    <span class="help-block" *ngIf="dateControl?.hasError('matDatepickerMax')">A visit cannot be booked more than a year ahead (max {{ maxDate | date:'yyyy-MM-dd' }})</span>
  `
})
export class VisitDateErrorsComponent {
  @Input() dateControl: NgModel;
  @Input() minDate: Date;
  @Input() maxDate: Date;
}
