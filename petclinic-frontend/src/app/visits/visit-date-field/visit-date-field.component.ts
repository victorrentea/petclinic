import {Component, Input} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';
import * as moment from 'moment';
import {Pet} from '../../pets/pet';

/**
 * The visit-date control, shared by the New Visit and Edit Visit forms: identical markup and,
 * since GitHub #40, an identical allowed range — the pet's birth date to a year from today.
 *
 * `viewProviders` hands the surrounding `<form>`'s NgForm down as this component's
 * ControlContainer, which is what lets a template-driven field be extracted at all: without it
 * the inner `name="date"` would register on no form, and the parent's `visitForm.valid` would
 * stop seeing this control — silently re-enabling the submit button the range check disables.
 */
@Component({
  selector: 'app-visit-date-field',
  templateUrl: './visit-date-field.component.html',
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}],
})
export class VisitDateFieldComponent {
  /** The visit's current date; one-way, exactly as the two forms bound it before. */
  @Input() value?: string;
  @Input() pet!: Pet;

  readonly maxVisitDate = moment().add(1, 'year');
  readonly maxVisitDateLabel = this.maxVisitDate.format('YYYY/MM/DD');

  get minVisitDate(): moment.Moment | undefined {
    return this.pet?.birthDate ? moment(this.pet.birthDate) : undefined;
  }
}
