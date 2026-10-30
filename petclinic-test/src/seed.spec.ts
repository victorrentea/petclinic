import {test} from './support/trace-fixture';

// Seed of the Playwright Test Agents (planner, generator, healer): they start every page from here.
test.use({dbFixture: 'default'});

test.describe('Test group', () => {
  test('seed', async ({page}) => {
    await page.goto('/');
  });
});
