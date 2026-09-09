import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ComboComponent} from './combo.component';
import {TooltipDirective} from './tooltip.directive';

/** The standardised widgets every screen is expected to use. */
@NgModule({
  imports: [CommonModule],
  declarations: [ComboComponent, TooltipDirective],
  exports: [ComboComponent, TooltipDirective]
})
export class DesignSystemModule {
}
