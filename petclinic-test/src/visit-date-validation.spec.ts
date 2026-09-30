import {expect, Page} from '@playwright/test';
import axios from 'axios';
import {test} from './support/trace-fixture';

// Issue #40: a visit is dated between the pet's birth and one year from today.
// No test here submits a valid form: specs in src/ must not create visits (see AGENTS.md).

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';
const AXEL_ID = 1;
const TODAY = '2026-09-10';

async function open_new_visit_form(page: Page, petId: number): Promise<void> {
  await page.goto(`/pets/${petId}/visits/add`);
  await page.locator('h2:has-text("New Visit")').waitFor({state: 'visible', timeout: 10_000});
  await page.locator('input#description').fill('Check-up');
}

async function enter_visit_date(page: Page, date: string): Promise<void> {
  await page.locator('input[name="date"]').fill(date);
  await page.locator('input[name="date"]').blur();
}

async function expect_refused(page: Page, message: string): Promise<void> {
  await expect(page.locator('.help-block', {hasText: message})).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeDisabled();
}

async function expect_accepted(page: Page): Promise<void> {
  await expect(page.locator('.help-block')).toHaveCount(0);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
}

test.describe('A visit is dated between the pet\'s birth and one year from today', () => {
  let birthDate: string;

  test.beforeAll(async () => {
    ({data: {birthDate}} = await axios.get(`${API_BASE}/pets/${AXEL_ID}`, {timeout: 10_000}));
  });

  test.beforeEach(async ({page}) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
    await open_new_visit_form(page, AXEL_ID);
  });

  test('A visit in the year 0009 is refused', async ({page}) => {
    await enter_visit_date(page, '0009-07-20');
    await expect_refused(page, `A visit cannot predate the pet's birth (${birthDate})`);
  });

  test('A visit the day before the pet was born is refused', async ({page}) => {
    await enter_visit_date(page, dayBefore(birthDate));
    await expect_refused(page, `A visit cannot predate the pet's birth (${birthDate})`);
  });

  test('A visit on the pet\'s birthday is accepted', async ({page}) => {
    await enter_visit_date(page, birthDate);
    await expect_accepted(page);
  });

  test('A visit more than a year ahead is refused', async ({page}) => {
    await enter_visit_date(page, '2027-09-11');
    await expect_refused(page, 'A visit cannot be booked more than a year ahead (2027-09-10)');
  });

  test('A visit exactly one year ahead is accepted', async ({page}) => {
    await enter_visit_date(page, '2027-09-10');
    await expect_accepted(page);
  });
});

function dayBefore(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
