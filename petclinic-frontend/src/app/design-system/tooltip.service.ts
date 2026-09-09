import { Injectable, OnDestroy } from '@angular/core';

/**
 * The app's single tooltip. One bubble element, one set of listeners delegated on
 * `document`, one attribute (`data-tip`) to opt in.
 *
 * Delegation rather than per-element binding is deliberate: anything rendered later
 * — a new row, a new page, a component that did not exist when this ran — works
 * without a registration step, so the attribute never silently does nothing.
 *
 * Never use the native `title`: it cannot be styled and appears after ~500ms, by
 * which point the reader has given up. `scripts/check-no-native-title.js` fails the
 * build on one.
 */
@Injectable({ providedIn: 'root' })
export class TooltipService implements OnDestroy {
  private static readonly ATTRIBUTE = 'data-tip';
  private static readonly SHOW_DELAY_MS = 150;
  private static readonly GAP_PX = 10;
  private static readonly EDGE_PX = 8;

  private bubble?: HTMLElement;
  private showTimer?: number;
  private started = false;

  /** Wires the listeners once; further calls are ignored. */
  start(): void {
    if (this.started || typeof document === 'undefined') {
      return;
    }
    this.started = true;
    this.injectStyles();

    document.addEventListener('mouseover', (e) => this.onEnter(e));
    document.addEventListener('mouseout', () => this.hide());
    document.addEventListener('focusin', (e) => this.onEnter(e));
    document.addEventListener('focusout', () => this.hide());
    document.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') {
        this.hide();
      }
    });
    // A fixed bubble positioned once would float away from its trigger, and on
    // touch a tap would leave it stuck open.
    window.addEventListener('scroll', () => this.hide(), true);
    document.addEventListener('touchstart', () => this.hide(), { passive: true });
  }

  ngOnDestroy(): void {
    this.hide();
    this.bubble?.remove();
  }

  private onEnter(event: Event): void {
    const trigger = (event.target as HTMLElement)?.closest?.(`[${TooltipService.ATTRIBUTE}]`);
    if (!(trigger instanceof HTMLElement)) {
      return;
    }
    const tip = trigger.getAttribute(TooltipService.ATTRIBUTE)?.trim();
    if (!tip || this.saysNothingNew(trigger, tip)) {
      return;
    }
    window.clearTimeout(this.showTimer);
    this.showTimer = window.setTimeout(() => this.show(trigger, tip), TooltipService.SHOW_DELAY_MS);
  }

  /**
   * A tip repeating text the reader can already see in full is noise. It earns its
   * place only when the element is clipping its own content — which is exactly the
   * truncated-table-cell case this exists for.
   */
  private saysNothingNew(trigger: HTMLElement, tip: string): boolean {
    const isClipped = trigger.scrollWidth > trigger.clientWidth + 1;
    return !isClipped && tip === trigger.textContent?.trim();
  }

  private show(trigger: HTMLElement, tip: string): void {
    const bubble = this.ensureBubble();
    bubble.textContent = tip;
    bubble.classList.add('pc-tooltip--visible');

    const anchor = trigger.getBoundingClientRect();
    const self = bubble.getBoundingClientRect();

    let top = anchor.top - self.height - TooltipService.GAP_PX;
    if (top < TooltipService.EDGE_PX) {
      top = anchor.bottom + TooltipService.GAP_PX; // no room above — flip below
    }
    const centred = anchor.left + anchor.width / 2 - self.width / 2;
    const rightMost = window.innerWidth - self.width - TooltipService.EDGE_PX;
    const left = Math.max(TooltipService.EDGE_PX, Math.min(centred, rightMost));

    bubble.style.top = `${Math.round(top)}px`;
    bubble.style.left = `${Math.round(left)}px`;
  }

  private hide(): void {
    window.clearTimeout(this.showTimer);
    this.bubble?.classList.remove('pc-tooltip--visible');
  }

  private ensureBubble(): HTMLElement {
    if (!this.bubble) {
      this.bubble = document.createElement('div');
      this.bubble.className = 'pc-tooltip';
      this.bubble.setAttribute('role', 'tooltip');
      document.body.appendChild(this.bubble);
    }
    return this.bubble;
  }

  /** Shipped from here, so a page cannot pick up the behaviour without the look. */
  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
.pc-tooltip {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  max-width: 22rem;
  padding: 0.6rem 0.9rem;
  border-radius: 0.6rem;
  background: rgba(20, 20, 22, 0.96);
  color: #fff;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.25;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 120ms ease, transform 120ms ease;
}
.pc-tooltip--visible {
  opacity: 1;
  transform: translateY(0);
}`;
    document.head.appendChild(style);
  }
}
