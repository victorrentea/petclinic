import {Component, forwardRef, HostBinding, Input} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

export type ComboCompareFn = (a: any, b: any) => boolean;

/**
 * The design-system single-select. Same API surface as the `<select>` it replaces:
 * bind `[(ngModel)]` (or a reactive control) to it, hand it the `options`, and it
 * behaves like a native single-select — including `required` on the host, which
 * Angular's RequiredValidator picks up because this is a ControlValueAccessor.
 *
 * `data-ds="combo"` on the host is the marker the design-system audit looks for.
 */
@Component({
  selector: 'app-combo',
  templateUrl: './combo.component.html',
  styleUrls: ['./combo.component.css'],
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ComboComponent), multi: true}]
})
export class ComboComponent implements ControlValueAccessor {
  /** The design-system marker every standardised combo carries into the DOM. */
  @HostBinding('attr.data-ds') readonly designSystemMarker = 'combo';

  /** The rows to offer. Objects, or primitives when neither labelKey nor valueKey is set. */
  @Input() options: any[] = [];
  /** Property read for an option's visible text; ignored when the option is a primitive. */
  @Input() labelKey = 'name';
  /** Property read for the bound value. Unset means the whole option object is bound. */
  @Input() valueKey: string | null = null;
  /** When set, an extra leading entry bound to null, e.g. '-- not assigned --'. */
  @Input() placeholder: string | null = null;
  /** id put on the inner control, so an outer `<label for="...">` still points at it. */
  @Input() inputId: string | null = null;
  @Input() compareWith: ComboCompareFn = (a, b) => a === b;

  value: any = null;
  disabled = false;

  private onChange: (value: any) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  labelOf(option: any): string {
    return option !== null && typeof option === 'object' ? option[this.labelKey] : option;
  }

  valueOf(option: any): any {
    return this.valueKey !== null && option !== null && typeof option === 'object' ? option[this.valueKey] : option;
  }

  /** Index of the currently bound value among the options, or -1 for the placeholder. */
  get selectedIndex(): number {
    return this.options.findIndex(option => this.compareWith(this.valueOf(option), this.value));
  }

  pick(index: string): void {
    const option = this.options[Number(index)];
    this.value = index === '' ? null : this.valueOf(option);
    this.onChange(this.value);
  }

  blur(): void {
    this.onTouched();
  }

  writeValue(value: any): void {
    this.value = value;
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
