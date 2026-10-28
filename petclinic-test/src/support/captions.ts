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
export function keepCaptionAcrossLoads(page: Page, current: () => string | undefined): void {
  page.on('load', () => {
    const text = current();
    if (text) void showCaption(page, text);
  });
}

const TIKTOK_ID = '__e2e_tiktok_caption__';

/**
 * TikTok-style subtitle (PW_NARRATE=on): big outlined words in the middle of the screen,
 * popping in one by one across `durationMs` — the length of the voice-over saying them —
 * with the word being spoken highlighted. Replaces the plain bar of {@link showCaption}.
 */
export async function showTikTokCaption(page: Page, text: string, durationMs: number,
                                        tone: 'step' | 'pass' | 'fail' = 'step'): Promise<void> {
  await page.evaluate(({id, text, durationMs, tone}) => {
    document.getElementById(id)?.remove();
    const box = document.createElement('div');
    box.id = id;
    Object.assign(box.style, {
      position: 'fixed', left: '6%', right: '6%', top: '58%', zIndex: '2147483647',
      textAlign: 'center', pointerEvents: 'none',
      font: '900 46px/1.25 "Arial Black", Impact, system-ui, sans-serif', color: '#fff',
      textTransform: 'uppercase', letterSpacing: '1px',
      textShadow: '0 0 6px #000, 3px 3px 0 #000, -3px 3px 0 #000, 3px -3px 0 #000, -3px -3px 0 #000',
    });
    const highlight = {step: '#ffe600', pass: '#39ff6a', fail: '#ff3b3b'}[tone];
    const words = text.split(/\s+/).filter(Boolean);
    const perWord = Math.round(durationMs / Math.max(words.length, 1));
    // CSS animations, not setTimeout: a scenario that pins the page's clock (page.clock) freezes its timers.
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ${id}-pop {from {opacity: 0; transform: scale(.6)} to {opacity: 1; transform: scale(1)}}
      @keyframes ${id}-hl {from, to {color: ${highlight}}}`;
    box.appendChild(style);
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.textContent = word;
      const last = i === words.length - 1;
      Object.assign(span.style, {
        display: 'inline-block', margin: '0 7px', opacity: '0',
        animation: `${id}-pop 120ms ease-out ${i * perWord}ms forwards, ` +
          `${id}-hl ${perWord}ms linear ${i * perWord}ms ${last ? 'forwards' : 'none'}`,
      });
      box.appendChild(span);
    });
    document.body.appendChild(box);
  }, {id: TIKTOK_ID, text, durationMs, tone}).catch(() => undefined); // a page mid-navigation has no body yet
}
