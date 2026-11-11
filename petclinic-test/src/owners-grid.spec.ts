import {test} from './support/trace-fixture';
import {GENERATE_SEQUENCE_TAG} from './genseq/sequence-tag';
import {narrate} from './genseq/steps';
import * as grid from './owners-grid.dsl';

// #25: the owners grid pages (5/10/20 rows) and sorts by Name or City, on the 26 seeded owners.

test.use({dbFixture: 'default'});

const {
  choose_rows_per_page,
  expect_not_sortable,
  expect_sorted,
  expect_the_grid_to_show,
  go_back,
  go_to_the_next_page,
  open_the_first_listed_owner,
  open_the_owners_grid,
  search_last_name,
  sort_by,
} = narrate(grid);

test('Paging 5 rows at a time, the second page shows owners 6 to 10',
  {tag: [GENERATE_SEQUENCE_TAG]},
  async ({page}) => {
    await open_the_owners_grid(page);
    await expect_the_grid_to_show(page, {page: 0, size: 10, sort: 'name,asc'}, /^1 – 10 of /);
    await expect_sorted(page, 'Name', 'ascending');

    await choose_rows_per_page(page, 5);
    await go_to_the_next_page(page);

    await expect_the_grid_to_show(page, {page: 1, size: 5, sort: 'name,asc'}, /^6 – 10 of /);
  });

test('City sorts ascending, then descending; Address, Telephone and Pets do not sort', async ({page}) => {
  await open_the_owners_grid(page);

  await sort_by(page, 'City');
  await expect_sorted(page, 'City', 'ascending');
  await expect_the_grid_to_show(page, {page: 0, size: 10, sort: 'city,asc'}, /^1 – 10 of /);

  await sort_by(page, 'City');
  await expect_sorted(page, 'City', 'descending');
  await expect_the_grid_to_show(page, {page: 0, size: 10, sort: 'city,desc'}, /^1 – 10 of /);

  for (const column of ['Address', 'Telephone', 'Pets']) {
    await expect_not_sortable(page, column);
  }
});

test('Back from an owner returns to the same page and sort', async ({page}) => {
  await open_the_owners_grid(page);
  await sort_by(page, 'City');
  await go_to_the_next_page(page);
  await expect_the_grid_to_show(page, {page: 1, size: 10, sort: 'city,asc'}, /^11 – 20 of /);

  await open_the_first_listed_owner(page);
  await go_back(page);

  await expect_sorted(page, 'City', 'ascending');
  await expect_the_grid_to_show(page, {page: 1, size: 10, sort: 'city,asc'}, /^11 – 20 of /);
});

test('A new search goes back to the first page', async ({page}) => {
  await open_the_owners_grid(page);
  await go_to_the_next_page(page);
  await go_to_the_next_page(page);
  await expect_the_grid_to_show(page, {page: 2, size: 10, sort: 'name,asc'}, /^21 – /);

  await search_last_name(page, 'Potter');

  await expect_the_grid_to_show(page, {page: 0, size: 10, sort: 'name,asc', lastName: 'Potter'}, /^1 – 2 of 2$/);
});
