import {Directive, ElementRef, NgZone, OnDestroy} from '@angular/core';

/** Tells the template whether its element's text is cut off, so a toggle shows only when it is. */
@Directive({selector: '[appOverflow]', exportAs: 'overflow'})
export class OverflowDirective implements OnDestroy {
  overflowing = false;
  // Measured outside Angular's zone; change detection runs only when the answer flips.
  private readonly observer = new ResizeObserver(() => this.measure());

  constructor(private element: ElementRef<HTMLElement>, private zone: NgZone) {
    zone.runOutsideAngular(() => this.observer.observe(element.nativeElement));
  }

  ngOnDestroy() {
    this.observer.disconnect();
  }

  private measure() {
    const el = this.element.nativeElement;
    const overflowing = el.scrollWidth > el.clientWidth;
    if (overflowing !== this.overflowing) {
      this.zone.run(() => this.overflowing = overflowing);
    }
  }
}
