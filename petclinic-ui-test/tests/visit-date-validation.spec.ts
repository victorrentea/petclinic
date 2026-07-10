import {test, expect} from '@playwright/test';
import {VisitAddPage} from './pages/VisitAddPage';

/**
 * Issue #40: the New Visit form must restrict the visit date to
 * [pet birth date, today + 1 year]. This exercises the FRONTEND guard:
 * an out-of-range date keeps the "Add Visit" button disabled and shows an inline error.
 * Pet 11 (Baskerville) is seed data, born 2017-02-24.
 */
const PET_ID = 11;

test.describe('Add Visit — date range validation (issue #40)', () => {

  test('a date before the pet birth date keeps submit disabled and shows an error', async ({page}) => {
    const visitAdd = new VisitAddPage(page);
    await visitAdd.open(PET_ID);
    await visitAdd.waitForPetLoaded();

    await visitAdd.fillDescription('spring shots');
    await visitAdd.setDate('0009/07/20'); // ~2000 years before the pet was born

    await expect(visitAdd.addButton).toBeDisabled();
    await expect(visitAdd.dateBeforeBirthError).toBeVisible();
  });

  test('a date more than one year in the future keeps submit disabled', async ({page}) => {
    const visitAdd = new VisitAddPage(page);
    await visitAdd.open(PET_ID);
    await visitAdd.waitForPetLoaded();

    await visitAdd.fillDescription('spring shots');
    await visitAdd.setDateYearsFromToday(2);

    await expect(visitAdd.addButton).toBeDisabled();
    await expect(visitAdd.dateTooFarError).toBeVisible();
  });

  test('a valid date within range enables submit', async ({page}) => {
    const visitAdd = new VisitAddPage(page);
    await visitAdd.open(PET_ID);
    await visitAdd.waitForPetLoaded();

    await visitAdd.fillDescription('spring shots');
    await visitAdd.setTodayDate();

    await expect(visitAdd.addButton).toBeEnabled();
  });
});
