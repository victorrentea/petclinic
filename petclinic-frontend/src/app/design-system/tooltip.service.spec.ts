import { TestBed } from '@angular/core/testing';
import { TooltipService } from './tooltip.service';

const BUBBLE = '.pc-tooltip';
const VISIBLE = 'pc-tooltip--visible';

describe('TooltipService', () => {
  let service: TooltipService;
  let trigger: HTMLElement;

  const bubble = () => document.querySelector(BUBBLE) as HTMLElement | null;
  const hover = (el: HTMLElement) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

  /** Nothing is *shown* — the bubble element may exist, hidden, from an earlier show. */
  const showsNothing = () => !bubble()?.classList.contains(VISIBLE);

  beforeEach(() => {
    // Karma runs every spec in one browser; start from a clean DOM.
    document.querySelectorAll(BUBBLE).forEach((e) => e.remove());
    TestBed.configureTestingModule({});
    service = TestBed.inject(TooltipService);
    service.start();

    trigger = document.createElement('button');
    trigger.style.width = '40px';
    document.body.appendChild(trigger);
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    trigger.remove();
    service.ngOnDestroy();
    document.querySelectorAll(BUBBLE).forEach((e) => e.remove());
  });

  /** Hover and let the show delay elapse. */
  function hoverAndSettle(el: HTMLElement = trigger) {
    hover(el);
    jasmine.clock().tick(200);
  }

  it('shows the tip after the delay, and hides it on mouseout', () => {
    trigger.setAttribute('data-tip', 'Download everything as .zip');

    hoverAndSettle();

    expect(bubble()?.textContent).toBe('Download everything as .zip');
    expect(bubble()?.classList).toContain(VISIBLE);

    document.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(bubble()?.classList).not.toContain(VISIBLE);
  });

  it('shows nothing until the delay has passed', () => {
    trigger.setAttribute('data-tip', 'Later');

    hover(trigger);
    jasmine.clock().tick(100);

    expect(showsNothing()).toBe(true);
  });

  it('ignores an element with no tip', () => {
    hoverAndSettle();

    expect(showsNothing()).toBe(true);
  });

  it('ignores an empty tip, which conditional call sites render all the time', () => {
    trigger.setAttribute('data-tip', '   ');

    hoverAndSettle();

    expect(showsNothing()).toBe(true);
  });

  it('says nothing new: a tip repeating fully visible text is suppressed', () => {
    trigger.style.width = 'auto';   // wide enough that nothing is clipped
    trigger.textContent = 'Baskerville';
    trigger.setAttribute('data-tip', 'Baskerville');

    hoverAndSettle();

    expect(showsNothing()).toBe(true);
  });

  it('still shows that tip when the element is clipping its own text', () => {
    trigger.textContent = 'Baskerville';
    trigger.setAttribute('data-tip', 'Baskerville');
    // What a truncated table cell looks like: more content than box.
    spyOnProperty(trigger, 'scrollWidth').and.returnValue(500);
    spyOnProperty(trigger, 'clientWidth').and.returnValue(40);

    hoverAndSettle();

    expect(bubble()?.textContent).toBe('Baskerville');
  });

  it('finds the tip on an ancestor when the hover lands on a child', () => {
    trigger.setAttribute('data-tip', 'Owner row');
    const child = document.createElement('span');
    trigger.appendChild(child);

    hover(child);
    jasmine.clock().tick(200);

    expect(bubble()?.textContent).toBe('Owner row');
  });

  it('opens on keyboard focus and closes on Escape', () => {
    trigger.setAttribute('data-tip', 'Reachable without a mouse');

    trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    jasmine.clock().tick(200);
    expect(bubble()?.classList).toContain(VISIBLE);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(bubble()?.classList).not.toContain(VISIBLE);
  });

  it('hides on scroll, so a fixed bubble cannot float away from its trigger', () => {
    trigger.setAttribute('data-tip', 'Anchored');
    hoverAndSettle();

    window.dispatchEvent(new Event('scroll'));

    expect(bubble()?.classList).not.toContain(VISIBLE);
  });

  it('is positioned within the viewport', () => {
    trigger.setAttribute('data-tip', 'Clamped to the edges');

    hoverAndSettle();

    const box = bubble()!.getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(window.innerWidth + 1);
  });

  it('reuses one bubble however many triggers there are', () => {
    trigger.setAttribute('data-tip', 'First');
    const second = document.createElement('button');
    second.setAttribute('data-tip', 'Second');
    document.body.appendChild(second);

    hoverAndSettle();
    hoverAndSettle(second);

    expect(document.querySelectorAll(BUBBLE).length).toBe(1);
    expect(bubble()?.textContent).toBe('Second');
    second.remove();
  });

  it('wires its listeners once, however often start() is called', () => {
    service.start();
    service.start();
    trigger.setAttribute('data-tip', 'Only one bubble');

    hoverAndSettle();

    expect(document.querySelectorAll(BUBBLE).length).toBe(1);
  });
});
