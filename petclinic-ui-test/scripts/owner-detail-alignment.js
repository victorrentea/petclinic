// Cross-browser visual alignment check for the Owner detail page.
// Verifies (a) owner value column lines up with pet value column,
// (b) owner label column lines up with pet label column,
// (c) pet labels are left-aligned.
// Runs in Chromium, Firefox and WebKit; saves a screenshot + prints measured x offsets.
const { chromium, firefox, webkit } = require('playwright');
const path = require('path');

const URL = process.env.OWNER_URL || 'http://localhost:4200/petclinic/owners/14';
const OUT = path.join(__dirname, '..', 'test-results', 'alignment');
const TOLERANCE = 2; // px — sub-pixel rounding across engines is fine

const engines = { chromium, firefox, webkit };
const r2 = n => Math.round(n * 100) / 100;

(async () => {
  const fs = require('fs');
  fs.mkdirSync(OUT, { recursive: true });
  const summary = [];

  for (const [name, type] of Object.entries(engines)) {
    const browser = await type.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.ownerFullName');
    await page.waitForSelector('dd');

    const ownerValue = await page.locator('.ownerFullName').boundingBox();          // "Sam ..."
    const petValue = await page.locator('dd').first().boundingBox();                // "Lassie"
    const ownerLabel = await page.locator('table th').first().boundingBox();        // "Name" (owner)
    const petLabel = await page.locator('dt').first().boundingBox();                // "Name" (pet)
    const petLabelAlign = await page.locator('dt').first()
      .evaluate(el => getComputedStyle(el).textAlign);

    const valueDelta = r2(ownerValue.x - petValue.x);
    const labelDelta = r2(ownerLabel.x - petLabel.x);
    const aligned = Math.abs(valueDelta) <= TOLERANCE
      && Math.abs(labelDelta) <= TOLERANCE
      && petLabelAlign === 'left';

    const shot = path.join(OUT, `owner-detail-${name}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    summary.push({ name, valueDelta, labelDelta, petLabelAlign,
      ownerValueX: r2(ownerValue.x), petValueX: r2(petValue.x), aligned });
    await browser.close();
  }

  console.log('\n=== Owner vs Pet alignment ===');
  for (const r of summary) {
    console.log(
      `${r.name.padEnd(9)} valueΔ=${String(r.valueDelta).padStart(6)}px  ` +
      `labelΔ=${String(r.labelDelta).padStart(6)}px  petLabelAlign=${r.petLabelAlign.padEnd(6)}  ` +
      `${r.aligned ? 'OK ✅' : 'BAD ❌'}`);
  }
  const allOk = summary.every(r => r.aligned);
  console.log(`\nResult: ${allOk ? 'ALL GOOD ✅' : 'NOT aligned ❌'} (tolerance ${TOLERANCE}px)`);
  process.exit(allOk ? 0 : 1);
})();
