import {test, expect} from './support/trace-fixture';

// Starting point for the Playwright Test Agents (.claude/agents/playwright-test-*.md):
// the planner and the generator run this test first, then explore from the page it leaves.
test.describe('Seed', () => {
  test('seed', async ({page}) => {
    await page.goto('/');
    await expect(page.getByRole('heading', {name: 'Welcome to Petclinic'})).toBeVisible();
  });
});
