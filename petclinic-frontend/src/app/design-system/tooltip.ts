// The app's only tooltip: `data-tip="…"` on any element, anywhere, including markup rendered later.
// Never a native `title` (unstyled, ~500ms late); scripts/no-native-title.test.mjs enforces it.
const SHOW_DELAY_MS = 150;
const GAP_PX = 10;
const EDGE_PX = 8;

const STYLE = `
.app-tooltip {
  position: fixed; z-index: 10000; pointer-events: none; max-width: 22rem;
  background: rgba(20, 20, 22, 0.96); color: #fff; font-size: 1.25rem; font-weight: 600; line-height: 1.25;
  padding: 0.6rem 0.9rem; border-radius: 0.6rem; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  opacity: 0; transform: translateY(4px); transition: opacity 120ms ease, transform 120ms ease;
}
.app-tooltip.visible { opacity: 1; transform: translateY(0); }`;

/** Installs the delegated listeners once per document; returns a function that removes them. */
export function installTooltips(doc: Document): () => void {
  const style = doc.createElement('style');
  style.textContent = STYLE;
  doc.head.appendChild(style);
  const bubble = doc.createElement('div');
  bubble.className = 'app-tooltip';
  bubble.setAttribute('role', 'tooltip');
  doc.body.appendChild(bubble);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const hide = () => {
    clearTimeout(timer);
    bubble.classList.remove('visible');
  };
  const show = (event: Event) => {
    const trigger = (event.target as Element | null)?.closest?.('[data-tip]') as HTMLElement | null;
    const tip = trigger?.dataset.tip;
    if (!trigger || !tip) {
      return;
    }
    if (!trigger.hasAttribute('aria-label') && !trigger.textContent.trim()) {
      trigger.setAttribute('aria-label', tip);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      bubble.textContent = tip;
      place(bubble, trigger.getBoundingClientRect(), doc.defaultView);
      bubble.classList.add('visible');
    }, SHOW_DELAY_MS);
  };
  const leave = (event: Event) => {
    if ((event.target as Element | null)?.closest?.('[data-tip]')) {
      hide();
    }
  };
  const onKey = (event: KeyboardEvent) => event.key === 'Escape' && hide();

  const listeners: [string, EventListener][] = [
    ['mouseover', show], ['focusin', show], ['mouseout', leave], ['focusout', leave],
    ['keydown', onKey as EventListener], ['scroll', hide], ['touchstart', hide]];
  listeners.forEach(([type, listener]) => doc.addEventListener(type, listener, true));
  return () => {
    hide();
    listeners.forEach(([type, listener]) => doc.removeEventListener(type, listener, true));
    bubble.remove();
    style.remove();
  };
}

// centred above the trigger, flipped below when there is no room, clamped to the viewport
function place(bubble: HTMLElement, target: DOMRect, view: Window) {
  const {width, height} = bubble.getBoundingClientRect();
  const above = target.top - GAP_PX - height;
  const top = above >= EDGE_PX ? above : target.bottom + GAP_PX;
  const centred = target.left + target.width / 2 - width / 2;
  const left = Math.min(Math.max(centred, EDGE_PX), view.innerWidth - width - EDGE_PX);
  bubble.style.top = `${top}px`;
  bubble.style.left = `${left}px`;
}
