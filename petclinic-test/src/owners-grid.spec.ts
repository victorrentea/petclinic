import {test} from './support/trace-fixture';
import {narrate} from './genseq/steps';
import * as sentences from './owners-grid.dsl';

// The owner-list spec's grid scenarios (openspec/changes/paginate-owners-grid/specs/owner-list/spec.md)
// in a real browser. Read-only: no owner or visit is created.

const {
  choose_rows_per_page,
  click_the_header,
  expect_cities_in_order,
  expect_names_in_order,
  expect_rows_shown,
  expect_the_address,
  expect_the_grid_to_show,
  go_to_the_next_page,
  header_positions,
  expect_the_headers_at,
  open_the_first_owner_and_press_back,
  open_the_owners_grid,
  reload_the_page,
  rows_shown,
} = narrate(sentences);

test('opens on page 1 by name, with nothing in the address', async ({page}) => {
  await open_the_owners_grid(page);

  await expect_rows_shown(page, 10);
  await expect_names_in_order(page, 'asc');
  await expect_the_address(page, '');
});

test('the next page shows the second page by name', async ({page}) => {
  await open_the_owners_grid(page);

  const secondPage = await go_to_the_next_page(page);

  await expect_the_address(page, '?page=2');
  await expect_the_grid_to_show(page, secondPage);
  await expect_names_in_order(page, 'asc');
});

test('5 or 20 rows per page, back on page 1', async ({page}) => {
  await open_the_owners_grid(page, '?page=2');

  await choose_rows_per_page(page, 5);
  await expect_the_address(page, '?size=5');
  await expect_rows_shown(page, 5);

  await choose_rows_per_page(page, 20);
  await expect_the_address(page, '?size=20');
  await expect_rows_shown(page, 20);
});

test('Name sorts both ways', async ({page}) => {
  await open_the_owners_grid(page);

  await click_the_header(page, 'Name');

  await expect_the_address(page, '?sort=name,desc');
  await expect_names_in_order(page, 'desc');
});

test('City sorts both ways, owners in one city always by name', async ({page}) => {
  await open_the_owners_grid(page, '?size=20');

  await click_the_header(page, 'City');
  await expect_the_address(page, '?size=20&sort=city,asc');
  await expect_cities_in_order(page, 'asc');

  await click_the_header(page, 'City');
  await expect_the_address(page, '?size=20&sort=city,desc');
  await expect_cities_in_order(page, 'desc');
});

test('Back from an owner returns to the same page and sort', async ({page}) => {
  await open_the_owners_grid(page, '?page=2&sort=city,desc');

  const shownAfterBack = await open_the_first_owner_and_press_back(page);

  await expect_the_address(page, '?page=2&sort=city,desc');
  await expect_the_grid_to_show(page, shownAfterBack);
  await expect_cities_in_order(page, 'desc');
});

test('a refresh keeps the page and the page size', async ({page}) => {
  await open_the_owners_grid(page, '?page=3&size=5');

  const shownAfterRefresh = await reload_the_page(page);

  await expect_the_address(page, '?page=3&size=5');
  await expect_the_grid_to_show(page, shownAfterRefresh);
  await expect_rows_shown(page, 5);
});

test('the columns keep their place when the sort changes', async ({page}) => {
  await open_the_owners_grid(page, '?size=5&sort=city,asc');
  await expect_cities_in_order(page, 'asc');
  const before = await header_positions(page);

  await click_the_header(page, 'City');

  await expect_cities_in_order(page, 'desc');
  await expect_the_headers_at(page, before);
});
