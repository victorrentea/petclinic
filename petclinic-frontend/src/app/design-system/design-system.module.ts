import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ComboComponent} from './combo.component';

/** The standardised widgets every screen is expected to use. */
@NgModule({
  imports: [CommonModule],
  declarations: [ComboComponent],
  exports: [ComboComponent]
})
export class DesignSystemModule {
}
