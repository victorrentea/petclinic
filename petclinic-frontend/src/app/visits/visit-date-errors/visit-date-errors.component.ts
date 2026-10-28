import {Component, Input} from '@angular/core';
import {NgModel} from '@angular/forms';
import * as moment from 'moment';
import {Pet} from '../../pets/pet';

/** The messages under a visit's date input, shared by the add and edit forms. */
@Component({
  selector: 'app-visit-date-errors',
  template: `
    <ng-container *ngIf="date.dirty">
      <span class="help-block" *ngIf="date.hasError('required')">Date is required</span>
      <span class="help-block" *ngIf="date.hasError('matDatepickerParse')">Not a valid date</span>
      <span class="help-block" *ngIf="date.hasError('matDatepickerMin')">
        A visit can't predate {{ pet.name }}'s birth ({{ pet.birthDate }})</span>
      <span class="help-block" *ngIf="date.hasError('matDatepickerMax')">
        A visit can be at most one year ahead ({{ latestDate.format('YYYY-MM-DD') }})</span>
    </ng-container>`
})
export class VisitDateErrorsComponent {
  @Input() date: NgModel;
  @Input() pet: Pet;
  @Input() latestDate: moment.Moment;
}
