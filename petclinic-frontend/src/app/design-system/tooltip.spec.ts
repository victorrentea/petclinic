import {installTooltips} from './tooltip';

describe('tooltips (data-tip)', () => {
  let trigger: HTMLElement;
  let uninstall: () => void;

  beforeEach(() => {
    jasmine.clock().install();
    uninstall = installTooltips(document);
    trigger = document.createElement('span');
    trigger.textContent = '🐹';
    document.body.appendChild(trigger);
  });

  afterEach(() => {
    trigger.remove();
    uninstall();
    jasmine.clock().uninstall();
  });

  function bubble(): HTMLElement | null {
    return document.querySelector('.app-tooltip.visible');
  }

  it('shows the tip of any element on the page shortly after the pointer enters it', () => {
    trigger.dataset.tip = 'hamster';
    trigger.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
    expect(bubble()).toBeNull();

    jasmine.clock().tick(150);
    expect(bubble()?.textContent).toBe('hamster');

    trigger.dispatchEvent(new MouseEvent('mouseout', {bubbles: true}));
    expect(bubble()).toBeNull();
  });

  it('shows nothing for an empty tip', () => {
    trigger.dataset.tip = '';
    trigger.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
    jasmine.clock().tick(150);

    expect(bubble()).toBeNull();
  });

  it('shows on keyboard focus and hides on Escape', () => {
    const button = document.createElement('button');
    button.dataset.tip = 'Download';
    document.body.appendChild(button);

    button.dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
    jasmine.clock().tick(150);
    expect(bubble()?.textContent).toBe('Download');

    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    expect(bubble()).toBeNull();
    button.remove();
  });
});
