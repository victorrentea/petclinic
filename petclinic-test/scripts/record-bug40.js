// The browser half of record-bug40.sh. Same keystrokes in both takes; only the narration
// and the assertions differ, so "before" and "after" are provably the same scenario.
const fs = require('fs');
const {chromium} = require('playwright');

const [mode, baseUrl, apiUrl, videoDir, raw, cuesPath] = process.argv.slice(2);
const AFTER = mode === 'after';

const ABSURD_DATE = '0009-07-20';           // straight from the issue's repro steps
const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const TOO_FAR_DATE = plusDays(2 * 365);     // ~2 years out: past the 1-year ceiling
const VALID_DATE = plusDays(30);
const DEMO_TAG = 'Bug 40 demo';   // every row this script creates carries it, so cleanup can find them

(async () => {
  const owners = await (await fetch(apiUrl + '/api/owners')).json();
  const owner = owners.find(o => (o.pets || []).length > 0);
  if (!owner) throw new Error('no owner with a pet in the database');
  const pet = owner.pets[0];

  // The dev server answers on every path, but the Angular router only matches routes under
  // the <base href> the served index.html carries. Hardcoding "/" films an empty shell.
  const indexHtml = await (await fetch(baseUrl + '/')).text();
  const app = baseUrl + ((indexHtml.match(/<base href="([^"]*)"/) || [, '/'])[1]).replace(/\/$/, '');

  const browser = await chromium.launch({slowMo: 380});
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: {width: 1280, height: 800},
    recordVideo: {dir: videoDir, size: {width: 1280, height: 800}},
  });
  const page = await context.newPage();

  const t0 = Date.now();
  const cues = [];
  // A cue may name the element it is about. boundingBox() is viewport-relative, so it is
  // read at the moment the cue is spoken — after any scrolling — never earlier.
  const say = async (text, target) => {
    const cue = {t: (Date.now() - t0) / 1000, text};
    const box = target ? await target.boundingBox().catch(() => null) : null;
    if (box) {
      cue.box = {
        x: Math.round(box.x), y: Math.round(box.y),
        width: Math.round(box.width), height: Math.round(box.height),
      };
    }
    cues.push(cue);
  };
  const pause = (ms) => page.waitForTimeout(ms);

  const created = [];   // visit ids to clean up, so re-running does not litter the DB
  const problems = [];  // anything the take proves is still broken

  const dateInput = () => page.locator('input[name="date"]');
  const submit = () => page.locator('button[type="submit"]:has-text("Add Visit")');
  const dateErrors = () => page.locator('div.form-group:has(input[name="date"]) span.help-block');

  const openAddVisitForm = async () => {
    await page.goto(`${app}/pets/${pet.id}/visits/add`);
    await page.locator('h2:has-text("New Visit")').waitFor();
  };

  // Typing into a Material datepicker input only runs its validators once the control is
  // touched and blurred — fill() alone leaves the form pristine and the messages hidden.
  const enterDate = async (value) => {
    await dateInput().fill(value);
    await dateInput().blur();
  };

  await openAddVisitForm();
  await pause(900);

  const petRow = page.locator('table.table tbody tr, table.table tr').filter({hasText: pet.name}).first();
  await say(AFTER
      ? `Issue #40, after the fix. Same form, same pet: ${pet.name}, born ${pet.birthDate}.`
      : `Issue #40: the New Visit form. This is ${pet.name}, born ${pet.birthDate}.`, petRow);
  await pause(2600);

  await say('The issue\'s own repro step: type the year 9 into the visit date.', dateInput());
  await pause(1600);
  await enterDate(ABSURD_DATE);
  await pause(1400);

  await page.locator('input#description').fill(`${DEMO_TAG} ${Date.now()}`);
  await pause(900);

  const submitEnabled = await submit().isEnabled();
  const shownErrors = (await dateErrors().allTextContents()).map(t => t.trim()).filter(Boolean);

  if (AFTER) {
    if (submitEnabled) problems.push('form still accepts a date before the pet was born');
    const msg = shownErrors[0] || '(no message — the form is silent)';
    await say(`The form refuses it: “${msg}”`, dateErrors().first());
    await pause(3000);
    await say('And Add Visit is greyed out — there is nothing to submit.', submit());
    await pause(2400);

    await say(`The other end of the range: ${TOO_FAR_DATE}, roughly two years out.`, dateInput());
    await pause(1800);
    await enterDate(TOO_FAR_DATE);
    await pause(1300);
    const futureMsg = (await dateErrors().allTextContents()).map(t => t.trim()).filter(Boolean)[0]
        || '(no message)';
    if (await submit().isEnabled()) problems.push('form still accepts a date >1 year out');
    await say(`Rejected too: “${futureMsg}” — a visit may be booked at most a year ahead.`,
        dateErrors().first());
    await pause(3000);

    await say(`A date inside the window — ${VALID_DATE} — and the button comes back.`, dateInput());
    await enterDate(VALID_DATE);
    await pause(1500);
    if (!(await submit().isEnabled())) problems.push('form rejects a perfectly valid date');
    await say('Valid dates are untouched. The rule narrows the range, it does not block booking.',
        submit());
    await pause(2400);
    await submit().click();
    await page.locator('h2:has-text("Owner Information")').waitFor();
    const savedRow = page.locator('app-visit-list tr').filter({hasText: VALID_DATE}).first();
    await savedRow.scrollIntoViewIfNeeded().catch(() => {});
    await say('Saved, and listed under the pet — the happy path still works.', savedRow);
    await pause(2600);
  } else {
    if (!submitEnabled) problems.push('form already blocks the absurd date — bug not reproduced');
    await say('⚠ No error, no warning — and Add Visit is enabled. The form validates nothing.',
        submit());
    await pause(3000);
    await submit().click();
    await page.locator('h2:has-text("Owner Information")').waitFor();
    const savedRow = page.locator('app-visit-list tr').filter({hasText: '0009'}).first();
    await savedRow.scrollIntoViewIfNeeded().catch(() => {});
    await say('⚠ It saved. A visit dated year 9, two millennia before the pet was born.', savedRow);
    await pause(3200);
  }

  // The form is only half of it: the issue asks for the rule on both ends. Fire the same
  // absurd date straight at the API and narrate the status code the server actually returns.
  const res = await fetch(apiUrl + '/api/visits', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({date: ABSURD_DATE, description: `${DEMO_TAG} — direct API`, petId: pet.id}),
  });
  if (res.status === 201) {
    const id = (res.headers.get('location') || '').split('/').pop();
    if (id) created.push(id);
  }
  if (AFTER) {
    if (res.status !== 400) problems.push(`API still accepts the absurd date (HTTP ${res.status})`);
    await say(`Bypassing the form does not help: POST /api/visits with the same date → `
        + `HTTP ${res.status}. The rule lives on the server too.`);
  } else {
    await say(`⚠ And the form is not the only way in: POST /api/visits with the same date → `
        + `HTTP ${res.status}. The server has no rule either.`);
  }
  await pause(3400);

  await say(AFTER
      ? 'Both ends closed: the pet\'s birth date is the floor, one year from today the ceiling.'
      : 'Both ends open: any date at all, from either the form or the API. That is issue #40.');
  await pause(3000);

  // The boxes are frame pixels only if the page was rendered 1:1 at the recorded size.
  const geom = await page.evaluate(() => ({dpr: devicePixelRatio, w: innerWidth, h: innerHeight}));

  await context.close();
  await browser.close();

  // Sweep by description, not just by the ids this run collected: the visit booked through
  // the form comes back with no id here, and a take that crashed mid-way leaves its own.
  const all = await (await fetch(apiUrl + '/api/visits')).json().catch(() => []);
  for (const v of all.filter(v => (v.description || '').startsWith(DEMO_TAG))) created.push(v.id);
  for (const id of new Set(created)) {
    await fetch(`${apiUrl}/api/visits/${id}`, {method: 'DELETE'}).catch(() => {});
  }

  const webm = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'))
      .map(f => videoDir + '/' + f)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (!webm) throw new Error('playwright produced no .webm');
  fs.copyFileSync(webm, raw);
  fs.writeFileSync(cuesPath, JSON.stringify(cues, null, 1));

  console.error(`[video:${mode}] pet ${pet.name} (#${pet.id}), ${cues.length} cues -> ${raw}`);
  console.error(`[video:${mode}] viewport ${geom.w}x${geom.h} @ dpr ${geom.dpr}`);
  // A take that does not show what it narrates is worse than no take: fail loudly.
  if (problems.length) {
    console.error(`[video:${mode}] MISMATCH: ${problems.join('; ')}`);
    process.exitCode = 3;
  }
})().catch(e => { console.error('[video] ' + e.stack); process.exit(1); });
