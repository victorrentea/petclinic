import {expect, Page} from '@playwright/test';
import axios from 'axios';

// The glue code for the "Search owners by last name" feature, extracted as plain
// functions called by owner-search.steps.ts. Unlike add-visit, this feature has
// no plain-TypeScript twin: its contract is a table, so it lives in Gherkin only.

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8080/api';

const fullName = (o: {firstName: string; lastName: string}) => `${o.firstName} ${o.lastName}`;

/**
 * Every owner the clinic holds, by full name, after checking that the ones the
 * Background names are among them — so a changed seed (Flyway's
 * V3__sample_data.sql) fails on the Given instead of looking like a broken search.
 */
export async function fetchOwnerNamesIncluding(expected: string[]): Promise<string[]> {
  const {data: owners} = await axios.get(`${API_BASE}/owners`, {timeout: 10_000});
  if (!Array.isArray(owners) || owners.length === 0) {
    throw new Error('The API returned no owners — is the backend up and the DB seeded by Flyway?');
  }
  const names: string[] = owners.map(fullName);
  expect(names).toEqual(expect.arrayContaining(expected));
  return names;
}

export async function openOwnersPage(page: Page): Promise<void> {
  await page.goto('/owners');
  await page.locator('h2:has-text("Owners")').waitFor({state: 'visible', timeout: 10_000});
}

export async function searchOwnersByLastName(page: Page, search: string): Promise<void> {
  await page.locator('#lastName').fill(search);
  await page.locator('#search-owner-form button[type="submit"]').click();
}

/** Polls until the table has settled on exactly `expected` — order-insensitive. */
export async function expectOwnersListed(page: Page, expected: string[]): Promise<void> {
  const cells = page.locator('#ownersTable td.ownerFullName');
  const listed = async () => (await cells.allTextContents()).map((t) => t.trim()).filter(Boolean).sort();

  await expect.poll(listed, {timeout: 10_000}).toEqual([...expected].sort());
}
