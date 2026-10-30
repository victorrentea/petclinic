import {chromium, Locator, Page} from '@playwright/test';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import {hideTikTokCaption, showTikTokCaption} from '../support/captions';
import {Narration} from '../support/narration';

// Films issue #40 reproduced in the browser, as the issue tells it: Kevin's dog Axel gets a visit
// dated in the year 9. Run it once on the code before the fix and once after:
//
//   npx ts-node src/demo/bug-40.demo.ts before|after [trace|video]
//
// The steps run twice, since an annotation drawn into the page would land in the trace too:
//   trace → test-results/issue-40/<phase>.trace.zip, the bare app (`npx playwright show-trace` it)
//   video → test-results/issue-40/<phase>.mp4, with karaoke subtitles, a red frame on what is
//           talked about, and a voice-over (support/narration.ts)
// The visit the bug saves is deleted after each run, so the second starts from the same data.

const phase = process.argv[2] === 'after' ? 'after' : 'before';
const modes = (process.argv[3] ? [process.argv[3]] : ['trace', 'video']) as Mode[];
const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const API = process.env.API_BASE_URL || 'http://localhost:8080/api';
const OUT = path.join(__dirname, '..', '..', 'test-results', 'issue-40');
const SIZE = {width: 1280, height: 800};
const DESCRIPTION = 'ate the Christmas tinsel; kept under observation';
const YEAR_NINE = '0009-07-20';

type Mode = 'trace' | 'video';
type Tone = 'step' | 'pass' | 'fail';

async function main(): Promise<void> {
  const {data: owner} = await axios.get(`${API}/owners/1`);
  fs.mkdirSync(OUT, {recursive: true});
  for (const mode of modes) {
    await reproduce(mode, owner);
    await deleteVisitsSavedByTheBug(owner.id, owner.pets[0].id);
  }
}

async function reproduce(mode: Mode, owner: any): Promise<void> {
  const pet = owner.pets[0];
  const filming = mode === 'video';
  const browser = await chromium.launch({slowMo: 150});
  const context = await browser.newContext({baseURL: BASE_URL, viewport: SIZE,
    ...(filming && {recordVideo: {dir: OUT, size: SIZE}})});
  if (!filming) {
    await context.tracing.start({screenshots: true, snapshots: true, sources: true, title: `bug 40 ${phase}`});
  }
  const page = await context.newPage();
  const narration = new Narration(path.join(OUT, `.cues-${phase}`), Date.now());
  const say = (text: string, tone: Tone = 'step') =>
    filming ? subtitle(page, narration, text, tone) : Promise.resolve();
  const spotlight = (target: Locator) => filming ? frame(target) : Promise.resolve();

  await page.goto(`/owners/${owner.id}`);
  await page.locator('h2:has-text("Owner Information")').waitFor();
  const firstPaintMs = narration.elapsedMs();
  await say(phase === 'before' ? 'Bug forty. Before the fix. Watch this.' : 'Bug forty. After the fix. Watch this.');
  await spotlight(page.locator('app-pet-list').first());
  await say(`This is ${pet.name}. Great dog. Born ${pet.birthDate}.`);

  await page.locator('app-pet-list').first().locator('button:has-text("Add Visit")').click();
  await page.locator('h2:has-text("New Visit")').waitFor();
  await say(`We book ${pet.name} a visit. In the year nine!`);
  await page.locator('input[name="date"]').pressSequentially('0009/07/20', {delay: 120});
  await page.locator('input#description').pressSequentially(DESCRIPTION, {delay: 25});
  await spotlight(page.locator('#visit'));

  if (phase === 'before') {
    await say('A green check on the date. Add Visit is enabled. Nobody checks anything!', 'fail');
    await page.locator('button[type="submit"]:has-text("Add Visit")').click();
    await page.locator('h2:has-text("Owner Information")').waitFor();
    await page.locator('app-visit-list tr').filter({hasText: YEAR_NINE}).waitFor();
    await spotlight(page.locator('app-visit-list tr').filter({hasText: YEAR_NINE}));
    await say(`It saved it. Two thousand years before ${pet.name} was born. Total disaster!`, 'fail');
  } else {
    await say(`Now the form says no. A visit can't predate ${pet.name}'s birth.`, 'pass');
    await page.locator('button[type="submit"]:has-text("Add Visit")').click({force: true});
    await say('We click Add Visit anyway. Nothing happens. Nothing is saved.', 'pass');
    await page.locator('input[name="date"]').fill('');
    await page.locator('input[name="date"]').pressSequentially('2030/01/01', {delay: 120});
    await page.locator('input#description').click();
    await say('And more than one year ahead? Also refused. Beautiful!', 'pass');
  }

  if (!filming) {
    await context.tracing.stop({path: path.join(OUT, `${phase}.trace.zip`)});
    await browser.close();
    console.log(`🔎 ${path.join(OUT, `${phase}.trace.zip`)}`);
    return;
  }
  const video = page.video()!;
  await context.close();
  const webm = path.join(OUT, `${phase}.webm`);
  await video.saveAs(webm);
  await video.delete();
  await browser.close();
  console.log(`🎬 ${narration.muxOnto(webm, firstPaintMs)}`);
  fs.rmSync(webm);
}

async function subtitle(page: Page, narration: Narration, text: string, tone: Tone): Promise<void> {
  const {durationMs, words} = await narration.say(text);
  await showTikTokCaption(page, text, words, tone);
  await page.waitForTimeout(durationMs + 400);
  await hideTikTokCaption(page);
}

/** A red frame round what the narrator is talking about. */
async function frame(target: Locator): Promise<void> {
  await target.evaluate((el: HTMLElement) => {
    el.style.outline = '4px solid #ff3b3b';
    el.style.outlineOffset = '4px';
  }).catch(() => undefined);
}

async function deleteVisitsSavedByTheBug(ownerId: number, petId: number): Promise<void> {
  const {data: pet} = await axios.get(`${API}/owners/${ownerId}/pets/${petId}`);
  for (const visit of pet.visits.filter((v: any) => v.date === YEAR_NINE && v.description === DESCRIPTION)) {
    await axios.delete(`${API}/visits/${visit.id}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
