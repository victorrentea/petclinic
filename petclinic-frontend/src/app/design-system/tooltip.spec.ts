import {fakeAsync, tick} from '@angular/core/testing';
import {installTooltips} from './tooltip';

describe('tooltip', () => {
  let uninstall: () => void;
  let host: HTMLElement;
  const bubble = () => document.querySelector('.app-tooltip') as HTMLElement;

  beforeEach(() => {
    uninstall = installTooltips();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    uninstall();
    host.remove();
  });

  function hover(html: string): HTMLElement {
    host.innerHTML = html;
    const el = host.firstElementChild as HTMLElement;
    el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
    return el;
  }

  it('shows data-tip after a short delay, and hides on mouse out', fakeAsync(() => {
    const el = hover('<button data-tip="Download everything">⬇</button>');
    expect(bubble().classList).not.toContain('visible');

    tick(150);
    expect(bubble().classList).toContain('visible');
    expect(bubble().textContent).toBe('Download everything');

    el.dispatchEvent(new MouseEvent('mouseout', {bubbles: true}));
    expect(bubble().classList).not.toContain('visible');
  }));

  it('shows nothing for an empty data-tip', fakeAsync(() => {
    hover('<button data-tip="">x</button>');
    tick(150);
    expect(bubble().classList).not.toContain('visible');
  }));

  it('shows the full text of a cut-off cell, and nothing when it fits', fakeAsync(() => {
    const cell = 'style="display:block;width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"';
    hover(`<span data-tip-truncated ${cell}>Llanfairpwllgwyngyllgogerychwyrndrobwll</span>`);
    tick(150);
    expect(bubble().textContent).toBe('Llanfairpwllgwyngyllgogerychwyrndrobwll');

    bubble().classList.remove('visible');
    hover(`<span data-tip-truncated ${cell}>Ok</span>`);
    tick(150);
    expect(bubble().classList).not.toContain('visible');
  }));

  it('hides on Escape', fakeAsync(() => {
    hover('<button data-tip="Copy link">🔗</button>');
    tick(150);
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    expect(bubble().classList).not.toContain('visible');
  }));
});
