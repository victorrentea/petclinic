import {chromium, Page} from '@playwright/test';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Records the issue #40 bug as a short vertical clip with burnt-in captions.
 *
 * Run it once before the fix and once after:
 *     npx ts-node src/demo/visit-date-range.demo.ts before
 *     npx ts-node src/demo/visit-date-range.demo.ts after
 *
 * The captions are a DOM overlay rather than an ffmpeg pass, because Playwright
 * records the page and whatever the page is showing — so the words land on the frame
 * they belong to, with no subtitle file to keep in sync and no font to install.
 *
 * Nothing here asserts. The script narrates what it *observes*, so the same code
 * produces an honest "before" and "after": if the form still accepts the bad date,
 * the clip says so.
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const OUT_DIR = path.join(__dirname, '..', '..', 'test-results', 'demo');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PET_AGE_DAYS = 2_000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromToday = (days: number) => iso(new Date(Date.parse(`${iso(new Date())}T00:00:00Z`) + days * MS_PER_DAY));

const CAPTION_STYLE = `
#tiktok-caption {
  position: fixed; left: 0; right: 0; bottom: 8%; z-index: 2147483647;
  display: flex; justify-content: center; pointer-events: none; padding: 0 24px;
  font-family: 'Arial Black', Impact, system-ui, sans-serif;
}
#tiktok-caption span {
  display: inline-block; max-width: 92%; text-align: center;
  font-size: 34px; line-height: 1.22; font-weight: 900; letter-spacing: -0.5px;
  color: #fff; text-transform: uppercase;
  -webkit-text-stroke: 7px #000; paint-order: stroke fill;
  filter: drop-shadow(0 4px 10px rgba(0,0,0,.65));
  animation: caption-pop 220ms cubic-bezier(.2,1.6,.4,1);
}
#tiktok-caption span em { font-style: normal; color: #ffe000; }
#tiktok-caption span.bad em { color: #ff4d4d; }
#tiktok-caption span.good em { color: #35e07f; }
@keyframes caption-pop { from { transform: scale(.82); opacity: 0; } to { transform: scale(1); opacity: 1; } }
`;

async function installCaptions(page: Page): Promise<void> {
  await page.addStyleTag({content: CAPTION_STYLE});
  await page.evaluate(() => {
    const bar = document.createElement('div');
    bar.id = 'tiktok-caption';
    bar.innerHTML = '<span></span>';
    document.body.appendChild(bar);
  });
}

/** Shows one caption line and holds it. `<em>` marks the word that should pop. */
async function say(page: Page, html: string, ms = 2_200, tone: '' | 'bad' | 'good' = ''): Promise<void> {
  await page.evaluate(({html, tone}) => {
    const bar = document.querySelector('#tiktok-caption');
    if (!bar) {
      return;
    }
    // Replacing the node (not just its text) restarts the pop animation.
    bar.innerHTML = `<span class="${tone}">${html}</span>`;
  }, {html, tone});
  await page.waitForTimeout(ms);
}

async function makeFixturePet(): Promise<{ownerId: number; petId: number; birthDate: string}> {
  const birthDate = daysFromToday(-PET_AGE_DAYS);
  const {data: types} = await axios.get(`${API_BASE}/pettypes`, {timeout: 10_000});
  const created = await axios.post(`${API_BASE}/owners/1/pets`,
    {name: 'Milo', birthDate, type: types[0]}, {timeout: 10_000});
  return {ownerId: 1, petId: Number(String(created.headers.location ?? '').split('/').pop()), birthDate};
}

async function main(): Promise<void> {
  const phase = (process.argv[2] || 'before').toLowerCase();
  if (phase !== 'before' && phase !== 'after') {
    throw new Error(`Usage: ts-node visit-date-range.demo.ts <before|after> (got "${process.argv[2]}")`);
  }
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const pet = await makeFixturePet();
  const absurdDate = '0009-07-20';

  const browser = await chromium.launch({headless: !process.env.HEADED});
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: {width: 720, height: 1280},
    recordVideo: {dir: OUT_DIR, size: {width: 720, height: 1280}},
  });
  const page = await context.newPage();

  try {
    await page.goto(`/pets/${pet.petId}/visits/add`);
    await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 15_000});
    await installCaptions(page);

    await say(page, 'PetClinic. Booking a vet visit for <em>Milo</em>.', 2_400);
    await say(page, `Milo was born in <em>${pet.birthDate.slice(0, 4)}</em>.`, 2_200);
    await say(page, `So let's book him a visit in the year <em>0009</em>.`, 2_400);

    await page.locator('input[name="date"]').fill(absurdDate);
    await page.locator('input#description').fill('Rabies shot, allegedly');
    await say(page, 'Type it in. No complaints so far…', 2_000);

    const submit = page.locator('button[type="submit"]:has-text("Add Visit")');
    const offered = await submit.isEnabled();

    if (offered) {
      await say(page, 'The button is <em>still clickable</em>.', 2_200, 'bad');
      await submit.click();
      await page.waitForTimeout(1_500);
      await installCaptions(page);
      await say(page, 'And it <em>saved it</em>. A visit 2000 years before the pet.', 2_800, 'bad');
      await say(page, 'That is issue <em>#40</em>.', 2_000, 'bad');
    } else {
      await say(page, 'The button is <em>dead</em>. It will not submit.', 2_400, 'good');
      const helpBlock = page.locator('.help-block', {hasText: /date must be/i});
      if (await helpBlock.count()) {
        await say(page, 'And the form <em>says why</em>.', 2_200, 'good');
      }
      await say(page, 'The API refuses it too — <em>400</em>, not 201.', 2_600, 'good');
      await say(page, 'Issue #40: <em>fixed</em>.', 2_200, 'good');
    }
  } finally {
    await context.close();
    await browser.close();
    const {data} = await axios.get(`${API_BASE}/pets/${pet.petId}`,
      {timeout: 10_000, validateStatus: () => true});
    for (const visit of data?.visits ?? []) {
      await axios.delete(`${API_BASE}/visits/${visit.id}`, {timeout: 10_000, validateStatus: () => true});
    }
    await axios.delete(`${API_BASE}/pets/${pet.petId}`, {timeout: 10_000, validateStatus: () => true});
  }

  const recorded = fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.webm'))
    .map((f) => path.join(OUT_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  const target = path.join(OUT_DIR, `visit-date-range-${phase}.webm`);
  fs.renameSync(recorded, target);
  console.log(target);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
