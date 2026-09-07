import {Component, Input} from '@angular/core';
import {ControlContainer, NgForm} from '@angular/forms';
import {Pet} from '../../pets/pet';
import {earliestVisitDate, latestVisitDate} from '../visit-date-range';

/**
 * The visit form's Date field — the whole form-group, range and messages included.
 * Shared by visit-add and visit-edit so the range of GitHub issue #40 is stated once.
 *
 * `viewProviders` hands the child the parent's NgForm, so the `name="date"` inside this
 * template still registers as a control of the surrounding form — which is what keeps
 * `visitForm.value.date` and `visitForm.valid` working in both parents.
 */
@Component({
  selector: 'app-visit-date-field',
  templateUrl: './visit-date-field.component.html',
  viewProviders: [{provide: ControlContainer, useExisting: NgForm}],
})
export class VisitDateFieldComponent {

  @Input() pet: Pet;
  @Input() value: string;

  get minVisitDate(): Date | null {
    return earliestVisitDate(this.pet);
  }

  get maxVisitDate(): Date {
    return latestVisitDate();
  }
}
