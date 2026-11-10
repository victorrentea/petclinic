import {Component, Input} from '@angular/core';
import {NgModel} from '@angular/forms';
import {latestVisitDate} from '../visit-date-range';

/** The validation messages under a visit's date field, shared by the add and edit forms. */
@Component({
  selector: 'app-visit-date-errors',
  template: `
    <ng-container *ngIf="date.dirty">
      <span class="help-block" *ngIf="date.hasError('required')">Date is required</span>
      <span class="help-block" *ngIf="date.hasError('matDatepickerMin')">A visit can't predate the pet's birth ({{ birthDate }})</span>
      <span class="help-block" *ngIf="date.hasError('matDatepickerMax')">A visit can be booked at most one year ahead ({{ latestVisitDate }})</span>
    </ng-container>`
})
export class VisitDateErrorsComponent {
  @Input() date: NgModel;
  @Input() birthDate: string;
  readonly latestVisitDate = latestVisitDate();
}
