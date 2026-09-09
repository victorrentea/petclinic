import { Directive, ElementRef, Input, OnChanges } from '@angular/core';
import { TooltipService } from './tooltip.service';

/**
 * Opts an element into the app's one tooltip: `data-tip="..."` for a fixed string,
 * `[data-tip]="expression"` for a computed one.
 *
 * The directive only keeps the attribute in sync — showing, positioning and hiding
 * belong to {@link TooltipService}, which listens once on `document`.
 */
@Directive({ selector: '[data-tip]' })
export class TooltipDirective implements OnChanges {
  @Input('data-tip') tip = '';

  constructor(private readonly host: ElementRef<HTMLElement>, tooltips: TooltipService) {
    tooltips.start();
  }

  ngOnChanges(): void {
    // An empty tip shows nothing: conditional call sites render '' all the time.
    this.host.nativeElement.setAttribute('data-tip', this.tip ?? '');
  }
}
