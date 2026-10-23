import {test, expect} from './support/trace-fixture';
import axios from 'axios';

// What an e2e test starts on, pinned down — the browser suites' half of the backend's
// StartingDatabaseTest: the reference rows alone when it declares nothing, the Default seed
// when it says `test.use({dbFixture: 'default'})`, and never what the test before it wrote.
// Only a docker stack can reset (the /__reset sidecar); on `ng serve` these are skipped.

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:4200').replace(/\/$/, '');
const API = process.env.API_BASE_URL || 'http://localhost:8080/api';

test.beforeAll(async () => {
  const res = await axios.get(`${BASE}/__reset`, {validateStatus: () => true, timeout: 5_000})
    .catch(() => undefined);
  test.skip(res?.data?.ok !== true, `no reset sidecar behind ${BASE} — not a docker stack`);
});

type Owner = {id: number; firstName: string; lastName: string};
const owners = async () => (await axios.get(`${API}/owners`)).data.content as Owner[];

test.describe('a test that declares no DB fixture', () => {
  test('starts on an empty database, the reference pet types still there', async () => {
    expect(await owners()).toEqual([]);
    const {data: types} = await axios.get(`${API}/pettypes`);
    expect(types.map((t: {name: string}) => t.name))
      .toEqual(['cat', 'dog', 'lizard', 'snake', 'bird', 'hamster', 'horse']);

    await axios.post(`${API}/owners`, {firstName: 'Left', lastName: 'Behind', address: 'Nowhere 1',
      city: 'Gone', telephone: '0123456789'});
  });

  test('never sees what the test before it wrote', async () => {
    expect(await owners()).toEqual([]);
  });
});

test.describe('a test that declares the Default fixture', () => {
  test.use({dbFixture: 'default'});

  test('starts on the seed: owner 1 is Kevin McCallister', async () => {
    const kevin = (await axios.get(`${API}/owners/1`)).data as Owner;
    expect(`${kevin?.firstName} ${kevin?.lastName}`).toBe('Kevin McCallister');
  });
});
