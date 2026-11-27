/**
 * The app's one tooltip. Two declarative attributes, listeners delegated on the document so markup
 * rendered at any time needs no registration:
 * - `data-tip="text"`: always shows that text (an empty value shows nothing);
 * - `data-tip-truncated`: shows the element's own text, only while it is cut off by an ellipsis.
 * Never use a native `title`: it cannot be styled and shows after ~500ms.
 */
const STYLE = `
.app-tooltip {
  position: fixed; z-index: 10000; pointer-events: none; max-width: 22rem;
  background: rgba(20, 20, 22, 0.96); color: #fff; font-size: 1.25rem; font-weight: 600; line-height: 1.25;
  padding: 0.6rem 0.9rem; border-radius: 0.6rem; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  opacity: 0; transform: translateY(4px); transition: opacity 120ms ease, transform 120ms ease;
}
.app-tooltip.visible { opacity: 1; transform: translateY(0); }`;
const DELAY_MS = 150;
const GAP_PX = 10;
const EDGE_PX = 8;
const TRIGGER = '[data-tip], [data-tip-truncated]';

function tipText(el: HTMLElement): string {
  if (el.hasAttribute('data-tip')) {
    return el.getAttribute('data-tip') ?? '';
  }
  const cutOff = el.scrollWidth > el.clientWidth;
  return cutOff ? (el.textContent ?? '').trim() : '';
}

function place(bubble: HTMLElement, trigger: HTMLElement, view: Window) {
  const target = trigger.getBoundingClientRect();
  const {width, height} = bubble.getBoundingClientRect();
  const roomAbove = target.top - height - GAP_PX >= EDGE_PX;
  const top = roomAbove ? target.top - height - GAP_PX : target.bottom + GAP_PX;
  const centred = target.left + target.width / 2 - width / 2;
  const left = Math.min(Math.max(centred, EDGE_PX), view.innerWidth - width - EDGE_PX);
  bubble.style.top = `${top}px`;
  bubble.style.left = `${left}px`;
}

/** Installs the tooltip once per document; returns how to remove it (tests). */
export function installTooltips(doc: Document = document): () => void {
  const view = doc.defaultView as Window;
  const style = doc.createElement('style');
  style.textContent = STYLE;
  const bubble = doc.createElement('div');
  bubble.className = 'app-tooltip';
  bubble.setAttribute('role', 'tooltip');
  doc.head.appendChild(style);
  doc.body.appendChild(bubble);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const hide = () => {
    clearTimeout(timer);
    bubble.classList.remove('visible');
  };
  const show = (event: Event) => {
    const trigger = (event.target as Element | null)?.closest?.(TRIGGER) as HTMLElement | null;
    if (!trigger) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const text = tipText(trigger);
      if (!text) {
        return;
      }
      bubble.textContent = text;
      place(bubble, trigger, view);
      bubble.classList.add('visible');
    }, DELAY_MS);
  };
  const hideOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && hide();
  const listeners: [string, EventListener][] = [
    ['mouseover', show], ['focusin', show], ['mouseout', hide], ['focusout', hide],
    ['touchstart', hide], ['keydown', hideOnEscape as EventListener]
  ];
  listeners.forEach(([type, listener]) => doc.addEventListener(type, listener));
  view.addEventListener('scroll', hide, true);

  return () => {
    hide();
    listeners.forEach(([type, listener]) => doc.removeEventListener(type, listener));
    view.removeEventListener('scroll', hide, true);
    bubble.remove();
    style.remove();
  };
}
