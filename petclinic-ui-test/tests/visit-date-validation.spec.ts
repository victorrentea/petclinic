import { test, expect } from './support/trace-fixture';

// End-to-end coverage for Issue #40 — "Visit date has no range validation".
// The visit date must be restricted to:
//   - Min: the pet's birth date (a visit can't predate the pet)
//   - Max: 1 year in the future
// The rule must be enforced on BOTH the backend (API) and the frontend (form).
//
// The two `request`-based tests exercise the BACKEND guard in isolation (no
// browser), the `page`-based tests exercise the FRONTEND guard. Running the
// whole file therefore shows the fix landing layer by layer: first the backend
// tests go green, then the frontend ones.

const HOST = 'http://127.0.0.1:8080';
const API = `${HOST}/api`;

// Seed pet #1 = "Axel", born 2018-12-24 (see V3__sample_data.sql).
const PET_ID = 1;
const PET_BIRTH_DATE = '2018-12-24';
const ADD_VISIT_URL = `/petclinic/pets/${PET_ID}/visits/add`;

// The issue's own repro: an absurd year, well before the pet's birth date.
const BEFORE_BIRTH_ISO = '0009-07-20';
const BEFORE_BIRTH_TYPED = '0009/07/20'; // datepicker parse format is YYYY/MM/DD

function moreThanOneYearAhead(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
}

test.describe('Issue #40 — visit date range validation', () => {

  // ---------------------------------------------------------------------------
  // BACKEND guard — the API itself must reject out-of-range dates.
  // ---------------------------------------------------------------------------

  test('backend rejects a visit dated before the pet birth date', async ({ request }) => {
    const res = await request.post(`${API}/visits`, {
      data: { petId: PET_ID, date: BEFORE_BIRTH_ISO, description: 'e2e #40 before-birth' },
    });
    // If the (still-buggy) backend accepts it, delete the junk row so a red run
    // leaves the DB clean.
    if (res.status() === 201) {
      const location = res.headers()['location'];
      if (location) await request.delete(`${HOST}${location}`).catch(() => {});
    }
    expect(res.status()).toBe(400);
  });

  test('backend rejects a visit dated more than one year in the future', async ({ request }) => {
    const res = await request.post(`${API}/visits`, {
      data: { petId: PET_ID, date: moreThanOneYearAhead(), description: 'e2e #40 far-future' },
    });
    if (res.status() === 201) {
      const location = res.headers()['location'];
      if (location) await request.delete(`${HOST}${location}`).catch(() => {});
    }
    expect(res.status()).toBe(400);
  });

  test('backend still accepts a valid in-range visit date', async ({ request }) => {
    const res = await request.post(`${API}/visits`, {
      data: { petId: PET_ID, date: PET_BIRTH_DATE, description: 'e2e #40 in-range' },
    });
    // Always clean up the row this test creates.
    const location = res.headers()['location'];
    if (location) await request.delete(`${HOST}${location}`).catch(() => {});
    expect(res.status()).toBe(201);
  });

  // ---------------------------------------------------------------------------
  // FRONTEND guard — the form must block out-of-range dates before submitting.
  // ---------------------------------------------------------------------------

  test('frontend blocks submitting a visit dated before the pet birth date', async ({ page }) => {
    await page.goto(ADD_VISIT_URL);
    // Wait until the pet — and therefore its birth date, which becomes the
    // datepicker's `min` — has loaded (first table = the pet summary).
    await expect(page.locator('table').first()).toContainText(PET_BIRTH_DATE);

    const dateInput = page.locator('input[name="date"]');
    await dateInput.fill(BEFORE_BIRTH_TYPED);
    await dateInput.blur();
    await page.locator('input[name="description"]').fill('e2e #40 before-birth');

    // The date is invalid → the Add Visit button must stay disabled and an
    // explanatory hint must be shown.
    await expect(page.locator('#visit button[type="submit"]')).toBeDisabled();
    await expect(page.getByText(/before the pet.?s birth date/i)).toBeVisible();
  });
});
