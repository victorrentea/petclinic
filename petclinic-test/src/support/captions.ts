import {Page} from '@playwright/test';

// Subtitles for a recorded scenario (PW_VIDEO=on): the Gherkin step being run, drawn as a
// bar at the bottom of the page, so the video carries its own narration. Burned into the
// page rather than muxed as a subtitle track: every player shows it, and the ffmpeg
// Homebrew ships has no drawtext/subtitles filter to burn one in afterwards.

const BAR_ID = '__e2e_caption__';

export async function showCaption(page: Page, text: string, tone: 'step' | 'pass' | 'fail' = 'step'): Promise<void> {
  await page.evaluate(({id, text, tone}) => {
    let bar = document.getElementById(id);
    if (!bar) {
      bar = document.createElement('div');
      bar.id = id;
      Object.assign(bar.style, {
        position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '2147483647',
        padding: '14px 24px', font: '600 22px/1.3 system-ui, sans-serif', color: '#fff',
        textAlign: 'center', pointerEvents: 'none',
      });
      document.body.appendChild(bar);
    }
    bar.style.background = {step: 'rgba(0,0,0,.78)', pass: 'rgba(22,128,60,.92)', fail: 'rgba(190,30,30,.92)'}[tone];
    bar.textContent = text;
  }, {id: BAR_ID, text, tone}).catch(() => undefined); // a page mid-navigation has no body yet
}

/** Re-draws the caption after every full page load, which wipes the DOM it lived in. */
export function keepCaptionAcrossLoads(
  page: Page, current: () => {text: string; tone: 'step' | 'pass' | 'fail'} | undefined): void {
  page.on('load', () => {
    const caption = current();
    if (caption) void showCaption(page, caption.text, caption.tone);
  });
}

const TIKTOK_ID = '__e2e_tiktok_caption__';

/**
 * TikTok-style karaoke subtitle (PW_NARRATE=on): the whole line in big outlined white letters
 * in the middle of the screen, each word turning yellow when the voice-over says it (green or
 * red for a verdict) and staying so. `words` come from support/narration.ts, one per whitespace
 * token of `text`; `elapsedMs` redraws a line already being spoken, after a page load wiped it.
 */
export async function hideTikTokCaption(page: Page): Promise<void> {
  await page.evaluate(id => document.getElementById(id)?.remove(), TIKTOK_ID).catch(() => undefined);
}

export async function showTikTokCaption(page: Page, text: string, words: {atMs: number}[],
                                        tone: 'step' | 'pass' | 'fail' = 'step', elapsedMs = 0): Promise<void> {
  await page.evaluate(({id, text, starts, tone, elapsedMs}) => {
    document.getElementById(id)?.remove();
    const box = document.createElement('div');
    box.id = id;
    Object.assign(box.style, {
      position: 'fixed', left: '5%', right: '5%', bottom: '4%', zIndex: '2147483647',
      textAlign: 'center', pointerEvents: 'none',
      font: '900 44px/1.3 "Arial Black", Impact, system-ui, sans-serif', color: '#fff',
      textTransform: 'uppercase', letterSpacing: '1px',
      textShadow: '0 0 8px #000, 3px 3px 0 #000, -3px 3px 0 #000, 3px -3px 0 #000, -3px -3px 0 #000',
    });
    const highlight = {step: '#ffe600', pass: '#39ff6a', fail: '#ff3b3b'}[tone];
    // CSS animations, not setTimeout: a scenario that pins the page's clock (page.clock) freezes its timers.
    const style = document.createElement('style');
    style.textContent = `@keyframes ${id}-said {to {color: ${highlight}}}`;
    box.appendChild(style);
    text.split(/\s+/).filter(Boolean).forEach((word, i) => {
      const span = document.createElement('span');
      span.textContent = word;
      Object.assign(span.style, {
        display: 'inline-block', margin: '0 14px 0 0',
        animation: `${id}-said 80ms ease-out ${(starts[i] ?? 0) - elapsedMs}ms forwards`,
      });
      box.appendChild(span);
    });
    document.body.appendChild(box);
  }, {id: TIKTOK_ID, text, starts: words.map(w => w.atMs), tone, elapsedMs})
    .catch(() => undefined); // a page mid-navigation has no body yet
}
