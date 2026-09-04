/**
 * Films one half of the bug #40 clip — vertical, TikTok-shaped, with a cue list that
 * becomes the subtitles. Run it once against the buggy code and once against the fix:
 *
 *   npx ts-node tools/record-bug40.ts before
 *   npx ts-node tools/record-bug40.ts after
 *
 * Writes test-results/bug40/bug40-<phase>.webm plus a matching .srt. Subtitles are
 * burnt in afterwards by ffmpeg (see the sibling shell one-liner in the session notes)
 * — Playwright records no audio, so the words have to be on the screen to land.
 */
import {chromium, Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const PHASE = (process.argv[2] || 'before') as 'before' | 'after';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4200';
const API_URL = process.env.API_URL || 'http://127.0.0.1:8080';
const OUT_DIR = path.join(__dirname, '..', 'test-results', 'bug40');

const ABSURD_DATE = '0009-07-20';
const VIEWPORT = {width: 720, height: 1280};

interface Cue {
  start: number;
  end: number;
  text: string;
}

const cues: Cue[] = [];
let t0 = 0;

const elapsed = () => (Date.now() - t0) / 1000;

/** Shows a caption for `hold` seconds and records it, so picture and subtitle can never drift. */
async function say(page: Page, text: string, hold = 2.6): Promise<void> {
  const start = elapsed();
  await page.evaluate(([caption]) => {
    let el = document.getElementById('tk-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tk-caption';
      el.style.cssText = [
        'position:fixed', 'left:0', 'right:0', 'bottom:6%', 'z-index:99999',
        'padding:18px 24px', 'margin:0 20px', 'border-radius:16px',
        'background:rgba(10,10,12,.88)', 'color:#fff',
        'font:700 30px/1.25 -apple-system,Segoe UI,Roboto,sans-serif',
        'text-align:center', 'pointer-events:none',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = caption;
  }, [text]);
  await page.waitForTimeout(hold * 1000);
  cues.push({start, end: elapsed(), text});
}

async function highlight(page: Page, selector: string): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('[data-tk-glow]').forEach(e => {
      (e as HTMLElement).style.outline = '';
      e.removeAttribute('data-tk-glow');
    });
  });
  // Resolved through a Playwright locator, so engine selectors like :has-text() work too.
  const target = page.locator(selector).first();
  if (await target.count() === 0) {
    return;
  }
  await target.evaluate(el => {
    const node = el as HTMLElement;
    node.style.outline = '4px solid #ff2d55';
    node.style.outlineOffset = '3px';
    node.setAttribute('data-tk-glow', '1');
    node.scrollIntoView({block: 'center'});
  });
}

/** Types into a field the way a person would, so the viewer can read what is being entered. */
async function typeSlowly(page: Page, selector: string, text: string): Promise<void> {
  await page.locator(selector).click();
  await page.locator(selector).fill('');
  await page.locator(selector).pressSequentially(text, {delay: 130});
  await page.locator(selector).blur();
}

function toSrt(list: Cue[]): string {
  const stamp = (s: number) => {
    const ms = Math.round(s * 1000);
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
    const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
    return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, '0')}`;
  };
  return list
    .map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`)
    .join('\n');
}

async function aPetToVisit(): Promise<{ownerId: number; petId: number; petName: string; birthDate: string}> {
  const res = await fetch(`${API_URL}/api/owners`);
  const owners: any[] = await res.json();
  const owner = owners.find(o => o.pets?.some((p: any) => p.birthDate));
  const pet = owner.pets.find((p: any) => p.birthDate);
  return {ownerId: owner.id, petId: pet.id, petName: pet.name, birthDate: pet.birthDate};
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  const {ownerId, petId, petName, birthDate} = await aPetToVisit();

  const browser = await chromium.launch({channel: 'chrome'});
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: {dir: OUT_DIR, size: VIEWPORT},
  });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/pets/${petId}/visits/add`);
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible'});
  t0 = Date.now();

  if (PHASE === 'before') {
    await say(page, 'Bug #40 — the New Visit form takes any date at all.', 3.0);
    await highlight(page, 'table.table-striped');
    await say(page, `${petName} was born on ${birthDate}.`, 2.6);

    await highlight(page, 'input[name="date"]');
    await say(page, 'So let us book a check-up in the year 9.', 2.4);
    await typeSlowly(page, 'input[name="date"]', ABSURD_DATE);
    await typeSlowly(page, 'input#description', 'Time travel check-up');
    await say(page, 'No complaint. The button is happily enabled.', 2.8);

    await highlight(page, 'button[type="submit"]');
    await say(page, 'Submitting…', 1.6);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/owners\/\d+$/);
    await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible'});

    await highlight(page, 'app-visit-list tr:has-text("0009")');
    await say(page, 'Saved. A vet visit two thousand years before the pet existed.', 3.4);
  } else {
    await say(page, 'After the fix — same form, same absurd date.', 2.8);
    await typeSlowly(page, 'input[name="date"]', ABSURD_DATE);
    await typeSlowly(page, 'input#description', 'Time travel check-up');

    await highlight(page, '.help-block');
    await say(page, 'The form names the allowed range, right there.', 3.0);

    await highlight(page, 'button[type="submit"]');
    await say(page, 'And Add Visit is disabled — it cannot be sent.', 2.8);

    const status = await page.evaluate(async ([api, id, date]) => {
      const res = await fetch(`${api}/api/visits`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({petId: id, date, description: 'Time travel check-up'}),
      });
      return res.status;
    }, [API_URL, petId, ABSURD_DATE] as const);
    await say(page, `Bypass the form and post it straight to the API: ${status}.`, 3.2);

    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    await typeSlowly(page, 'input[name="date"]', soon.toISOString().slice(0, 10));
    await highlight(page, 'button[type="submit"]');
    await say(page, 'A real date, and the form is happy again.', 2.6);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/owners\/\d+$/);
    await page.locator('h2:has-text("Owner Information")').waitFor({state: 'visible'});
    await highlight(page, 'app-visit-list');
    await say(page, 'Booked. Bug #40 closed.', 3.0);
  }

  await context.close();
  await browser.close();

  const video = fs.readdirSync(OUT_DIR)
    .filter(f => f.endsWith('.webm') && !f.startsWith('bug40-'))
    .map(f => path.join(OUT_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  const target = path.join(OUT_DIR, `bug40-${PHASE}.webm`);
  fs.renameSync(video, target);
  fs.writeFileSync(path.join(OUT_DIR, `bug40-${PHASE}.srt`), toSrt(cues));
  console.log(`[video] ${target} (owner ${ownerId}, ${cues.length} cues)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
