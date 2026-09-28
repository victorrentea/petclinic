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
