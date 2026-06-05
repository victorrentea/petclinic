import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import {
  cleanDatabase,
  closeTestApp,
  createTestApp,
  ensureSchema,
  getDataSource,
  isDbAvailable,
} from './test-app';
import { savePet, savePetType, saveOwner } from './fixtures';
import { todayIso } from './fixtures';

/**
 * End-to-end tests for the owners endpoints.
 * Covers owner CRUD, last-name filter, nested pet read/update, and validation.
 */
describe('OwnerController (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let available = false;

  let ownerId: number;
  let petId: number;
  let petTypeId: number;

  beforeAll(async () => {
    available = await isDbAvailable();
    if (!available) {
      return;
    }
    await ensureSchema();
    app = await createTestApp();
    ds = getDataSource();
  });

  afterAll(async () => {
    if (available) {
      await closeTestApp();
    }
  });

  beforeEach(async () => {
    if (!available) {
      return;
    }
    await cleanDatabase();
    const owner = await saveOwner(ds, { firstName: 'George', lastName: 'Franklin' });
    ownerId = owner.id;
    const type = await savePetType(ds, 'dog');
    petTypeId = type.id;
    const pet = await savePet(ds, owner, type, { name: 'Rosy', birthDate: todayIso() });
    petId = pet.id;
  });

  const http = () => request(app.getHttpServer());

  it('getByIdOk', async () => {
    if (!available) return;
    const res = await http().get(`/api/owners/${ownerId}`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.id).toBe(ownerId);
    expect(res.body.firstName).toBe('George');
    expect(res.body.lastName).toBe('Franklin');
  });

  it('getById_notFound', async () => {
    if (!available) return;
    await http().get('/api/owners/99999').expect(404);
  });

  it('count_returnsOwnerCount', async () => {
    if (!available) return;
    const res = await http().get('/api/owners/count').expect(200);
    expect(Number(res.text)).toBe(1);
  });

  it('getAll', async () => {
    if (!available) return;
    const res = await http().get('/api/owners').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const match = res.body.content.find((o: { id: number }) => o.id === ownerId);
    expect(match).toMatchObject({ id: ownerId, firstName: 'George', lastName: 'Franklin' });
  });

  it('getAllWithLastNameFilter', async () => {
    if (!available) return;
    const owner2 = await saveOwner(ds, { lastName: 'Zephyrson' });
    const res = await http().get('/api/owners?lastName=Zephyr').expect(200);
    const match = res.body.content.find((o: { id: number }) => o.id === owner2.id);
    expect(match).toMatchObject({ id: owner2.id, lastName: 'Zephyrson' });
  });

  it('getAllWithNameFilter_notFound', async () => {
    if (!available) return;
    const res = await http().get('/api/owners?lastName=NonExistent').expect(200);
    expect(res.body.content).toEqual([]);
    expect(res.body.totalElements).toBe(0);
  });

  it('update_ok', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/owners/${ownerId}`).expect(200)).body;
    existing.firstName = 'GeorgeI';
    await http().put(`/api/owners/${ownerId}`).send(existing).expect(200);

    const updated = (await http().get(`/api/owners/${ownerId}`).expect(200)).body;
    expect(updated.firstName).toBe('GeorgeI');
  });

  it('update_okNoBodyId', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/owners/${ownerId}`).expect(200)).body;
    delete existing.id;
    existing.firstName = 'GeorgeII';
    await http().put(`/api/owners/${ownerId}`).send(existing).expect(200);

    const updated = (await http().get(`/api/owners/${ownerId}`).expect(200)).body;
    expect(updated.firstName).toBe('GeorgeII');
  });

  it('update_invalid', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/owners/${ownerId}`).expect(200)).body;
    existing.firstName = ''; // invalid firstName (@Length min 1)
    await http().put(`/api/owners/${ownerId}`).send(existing).expect(400);
  });

  // deleteOwner loads the owner together with its pets (and their visits) and
  // removes them bottom-up before deleting the owner, so deleting an owner that
  // still has a pet cascades cleanly.
  it('delete_ok (cascades owner+pet)', async () => {
    if (!available) return;
    await http().delete(`/api/owners/${ownerId}`).expect(200);
    await http().get(`/api/owners/${ownerId}`).expect(404);
  });

  // Companion to delete_ok that DOES pass today: deleting an owner with no pets.
  it('delete_ok (owner without pets)', async () => {
    if (!available) return;
    const lonely = await saveOwner(ds, { lastName: 'NoPets' });
    await http().delete(`/api/owners/${lonely.id}`).expect(200);
    await http().get(`/api/owners/${lonely.id}`).expect(404);
  });

  it('delete_notFound', async () => {
    if (!available) return;
    await http().delete('/api/owners/9999').expect(404);
  });

  it('createPet_invalid (missing name)', async () => {
    if (!available) return;
    const newPet = {
      birthDate: todayIso(),
      type: { id: petTypeId, name: 'dog' },
      // missing name -> validation error
    };
    await http().post(`/api/owners/${ownerId}/pets`).send(newPet).expect(400);
  });

  it('createPet_ok (201 + Location)', async () => {
    if (!available) return;
    const newPet = {
      name: 'Thor',
      birthDate: '2020-01-15',
      type: { id: petTypeId, name: 'dog' },
    };
    const res = await http().post(`/api/owners/${ownerId}/pets`).send(newPet).expect(201);
    expect(res.headers['location']).toMatch(/^\/api\/pets\/\d+$/);
  });

  it('getOwnerPet_ok', async () => {
    if (!available) return;
    const res = await http().get(`/api/owners/${ownerId}/pets/${petId}`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.id).toBe(petId);
    expect(res.body.name).toBe('Rosy');
  });

  it('getOwnerPet_ownerNotFound', async () => {
    if (!available) return;
    await http().get(`/api/owners/99999/pets/${petId}`).expect(404);
  });

  it('getOwnerPet_petNotFound', async () => {
    if (!available) return;
    await http().get(`/api/owners/${ownerId}/pets/99999`).expect(404);
  });

  it('updateOwnerPet_ok', async () => {
    if (!available) return;
    const petDto = {
      id: petId,
      name: 'Rosy Updated',
      birthDate: '2020-01-15',
      type: { id: petTypeId, name: 'dog' },
    };
    await http().put(`/api/owners/${ownerId}/pets/${petId}`).send(petDto).expect(200);
  });

  it('updateOwnerPet_ownerNotFound (still updates the pet by id -> 200)', async () => {
    if (!available) return;
    const petDto = {
      name: 'Thor',
      birthDate: todayIso(),
      type: { id: petTypeId, name: 'dog' },
    };
    // The controller looks up the pet by petId, not the owner.
    await http().put(`/api/owners/99999/pets/${petId}`).send(petDto).expect(200);
  });

  it('updateOwnerPet_petNotFound', async () => {
    if (!available) return;
    const petDto = {
      name: 'Ghost',
      birthDate: '2020-01-01',
      type: { id: petTypeId, name: 'dog' },
    };
    await http().put(`/api/owners/${ownerId}/pets/99999`).send(petDto).expect(404);
  });
});

/**
 * End-to-end tests for the paginated/sorted owners listing (GET /api/owners).
 * A separate describe so each test seeds its own owners on a clean DB.
 */
describe('OwnerController list — page envelope, sort & collation (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let available = false;

  beforeAll(async () => {
    available = await isDbAvailable();
    if (!available) {
      return;
    }
    await ensureSchema();
    app = await createTestApp();
    ds = getDataSource();
  });

  afterAll(async () => {
    if (available) {
      await closeTestApp();
    }
  });

  beforeEach(async () => {
    if (!available) {
      return;
    }
    await cleanDatabase();
  });

  const http = () => request(app.getHttpServer());

  // ---- 1.1 / 1.3: envelope shape & defaults ------------------------------------------

  it('returns a page envelope with default number=0 and size=10', async () => {
    if (!available) return;
    await saveOwner(ds, { firstName: 'A', lastName: 'One' });
    const res = await http().get('/api/owners').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual(
      expect.objectContaining({
        content: expect.any(Array),
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 10,
      }),
    );
  });

  // ---- 1.4: row shape, pet aggregation, offsets, filter, past-the-end -----------------

  it('row carries petNames and no visits/type/full-pet data', async () => {
    if (!available) return;
    const owner = await saveOwner(ds, { firstName: 'P', lastName: 'Owner' });
    const dog = await savePetType(ds, 'dog');
    await savePet(ds, owner, dog, { name: 'Rex' });
    await savePet(ds, owner, dog, { name: 'Bella' });

    const res = await http().get('/api/owners').expect(200);
    const row = res.body.content.find((o: { id: number }) => o.id === owner.id);
    expect(row.petNames).toEqual(['Bella', 'Rex']); // aggregated, ordered by name
    expect(row).not.toHaveProperty('pets');
    expect(row).not.toHaveProperty('visits');
    expect(row.petNames[0]).not.toHaveProperty('type');
    expect(Object.keys(row).sort()).toEqual(
      ['address', 'city', 'firstName', 'id', 'lastName', 'petNames', 'telephone'].sort(),
    );
  });

  it('owner with no pets has an empty petNames array', async () => {
    if (!available) return;
    const owner = await saveOwner(ds, { firstName: 'Lonely', lastName: 'NoPets' });
    const res = await http().get('/api/owners').expect(200);
    const row = res.body.content.find((o: { id: number }) => o.id === owner.id);
    expect(row.petNames).toEqual([]);
  });

  it('honors explicit page and size offsets', async () => {
    if (!available) return;
    // 12 owners, names A..L (firstName), default name-asc sort -> alphabetical
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    for (const l of letters) {
      await saveOwner(ds, { firstName: l, lastName: 'Z' });
    }
    const res = await http().get('/api/owners?page=2&size=5').expect(200);
    expect(res.body.number).toBe(2);
    expect(res.body.size).toBe(5);
    expect(res.body.totalElements).toBe(12);
    expect(res.body.totalPages).toBe(3);
    // offset 10..14 -> K, L (only 2 left)
    expect(res.body.content.map((o: { firstName: string }) => o.firstName)).toEqual(['K', 'L']);
  });

  it('combines lastName filter with pagination (filtered totalElements)', async () => {
    if (!available) return;
    await saveOwner(ds, { firstName: 'A', lastName: 'Davis' });
    await saveOwner(ds, { firstName: 'B', lastName: 'Dalton' });
    await saveOwner(ds, { firstName: 'C', lastName: 'Smith' });
    const res = await http().get('/api/owners?lastName=Da&page=0&size=10').expect(200);
    expect(res.body.totalElements).toBe(2);
    expect(res.body.content).toHaveLength(2);
    const lastNames = res.body.content.map((o: { lastName: string }) => o.lastName);
    expect(lastNames.sort()).toEqual(['Dalton', 'Davis']);
  });

  it('returns empty content for a page beyond the last', async () => {
    if (!available) return;
    await saveOwner(ds, { firstName: 'A', lastName: 'One' });
    await saveOwner(ds, { firstName: 'B', lastName: 'Two' });
    const res = await http().get('/api/owners?page=5&size=10').expect(200);
    expect(res.body.content).toEqual([]);
    expect(res.body.totalElements).toBe(2);
    expect(res.body.totalPages).toBe(1);
    expect(res.body.number).toBe(5);
  });

  // ---- 1.5 / 2.6: validation 400s ----------------------------------------------------

  it('400 for negative page', async () => {
    if (!available) return;
    await http().get('/api/owners?page=-1').expect(400);
  });

  it('400 for non-numeric page', async () => {
    if (!available) return;
    await http().get('/api/owners?page=abc').expect(400);
  });

  it('400 for non-numeric size', async () => {
    if (!available) return;
    await http().get('/api/owners?size=xyz').expect(400);
  });

  it('400 for size above the allowed range', async () => {
    if (!available) return;
    await http().get('/api/owners?size=101').expect(400);
  });

  it('400 for size below 1', async () => {
    if (!available) return;
    await http().get('/api/owners?size=0').expect(400);
  });

  it('400 for an unknown sort column (telephone)', async () => {
    if (!available) return;
    await http().get('/api/owners?sort=telephone,asc').expect(400);
  });

  it('400 for an invalid sort direction', async () => {
    if (!available) return;
    await http().get('/api/owners?sort=name,sideways').expect(400);
  });

  // ---- 2.1 / 2.2: sort-chain expansion -----------------------------------------------

  it('sort=name,asc orders by firstName, lastName, id', async () => {
    if (!available) return;
    // Same firstName "Ann" but different lastName to prove the lastName tiebreaker.
    const beta = await saveOwner(ds, { firstName: 'Ann', lastName: 'Beta' });
    const alpha = await saveOwner(ds, { firstName: 'Ann', lastName: 'Alpha' });
    const zoe = await saveOwner(ds, { firstName: 'Zoe', lastName: 'Aaa' });
    const res = await http().get('/api/owners?sort=name,asc').expect(200);
    const ids = res.body.content.map((o: { id: number }) => o.id);
    expect(ids).toEqual([alpha.id, beta.id, zoe.id]);
  });

  it('sort=city,desc orders by city DESC then name DESC then id ASC', async () => {
    if (!available) return;
    const paris = await saveOwner(ds, { firstName: 'A', lastName: 'A', city: 'Paris' });
    const berlin = await saveOwner(ds, { firstName: 'A', lastName: 'A', city: 'Berlin' });
    const amsterdam = await saveOwner(ds, { firstName: 'A', lastName: 'A', city: 'Amsterdam' });
    const res = await http().get('/api/owners?sort=city,desc').expect(200);
    const ids = res.body.content.map((o: { id: number }) => o.id);
    expect(ids).toEqual([paris.id, berlin.id, amsterdam.id]);
  });

  it('sort=address,asc orders by address then name then id', async () => {
    if (!available) return;
    const second = await saveOwner(ds, { firstName: 'A', lastName: 'A', address: 'B street' });
    const first = await saveOwner(ds, { firstName: 'A', lastName: 'A', address: 'A street' });
    const res = await http().get('/api/owners?sort=address,asc').expect(200);
    const ids = res.body.content.map((o: { id: number }) => o.id);
    expect(ids).toEqual([first.id, second.id]);
  });

  it('no sort param falls back to the name-asc chain', async () => {
    if (!available) return;
    const zed = await saveOwner(ds, { firstName: 'Zed', lastName: 'X' });
    const abe = await saveOwner(ds, { firstName: 'Abe', lastName: 'X' });
    const res = await http().get('/api/owners').expect(200);
    const firstNames = res.body.content.map((o: { firstName: string }) => o.firstName);
    expect(firstNames).toEqual(['Abe', 'Zed']);
    expect(res.body.content[0].id).toBe(abe.id);
    expect(res.body.content[1].id).toBe(zed.id);
  });

  // ---- 2.4: human collation (case + diacritics) --------------------------------------

  it('sorts case- and diacritic-insensitively (ana / Ána / ANA adjacent)', async () => {
    if (!available) return;
    // Surround the "ana" cluster with clear before/after names so we can assert adjacency.
    await saveOwner(ds, { firstName: 'aardvark', lastName: 'Z' });
    const ana = await saveOwner(ds, { firstName: 'ana', lastName: 'Z' });
    const anaAccent = await saveOwner(ds, { firstName: 'Ána', lastName: 'Z' });
    const anaUpper = await saveOwner(ds, { firstName: 'ANA', lastName: 'Z' });
    await saveOwner(ds, { firstName: 'bob', lastName: 'Z' });

    const res = await http().get('/api/owners?sort=name,asc').expect(200);
    const firstNames = res.body.content.map((o: { firstName: string }) => o.firstName);
    // the three ana-variants must be contiguous, between aardvark and bob
    const cluster = new Set([ana.id, anaAccent.id, anaUpper.id]);
    const ids = res.body.content.map((o: { id: number }) => o.id);
    const positions = ids
      .map((id: number, idx: number) => (cluster.has(id) ? idx : -1))
      .filter((idx: number) => idx >= 0);
    expect(positions).toEqual([1, 2, 3]); // adjacent, after aardvark, before bob
    expect(firstNames[0]).toBe('aardvark');
    expect(firstNames[4]).toBe('bob');
  });

  // ---- 2.5: empty values sort as empty string ----------------------------------------

  it('city,asc places owners without a city first', async () => {
    if (!available) return;
    await saveOwner(ds, { firstName: 'A', lastName: 'A', city: undefined });
    await saveOwner(ds, { firstName: 'B', lastName: 'B', city: 'Madison' });
    const res = await http().get('/api/owners?sort=city,asc').expect(200);
    expect(res.body.content[0].city == null || res.body.content[0].city === '').toBe(true);
    expect(res.body.content[1].city).toBe('Madison');
  });

  it('city,desc places owners without a city last', async () => {
    if (!available) return;
    await saveOwner(ds, { firstName: 'A', lastName: 'A', city: undefined });
    await saveOwner(ds, { firstName: 'B', lastName: 'B', city: 'Madison' });
    const res = await http().get('/api/owners?sort=city,desc').expect(200);
    expect(res.body.content[0].city).toBe('Madison');
    const last = res.body.content[1];
    expect(last.city == null || last.city === '').toBe(true);
  });

  // ---- 2.7: id-tiebreaker stability across pages -------------------------------------

  it('keeps duplicate-name owners stable across consecutive pages (id tiebreaker)', async () => {
    if (!available) return;
    // 6 owners with identical name/address/city -> only id can break the tie.
    const created: number[] = [];
    for (let i = 0; i < 6; i++) {
      const o = await saveOwner(ds, {
        firstName: 'Same',
        lastName: 'Name',
        address: 'Same St',
        city: 'Same City',
      });
      created.push(o.id);
    }
    const page0 = await http().get('/api/owners?sort=name,asc&page=0&size=3').expect(200);
    const page1 = await http().get('/api/owners?sort=name,asc&page=1&size=3').expect(200);
    const ids0 = page0.body.content.map((o: { id: number }) => o.id);
    const ids1 = page1.body.content.map((o: { id: number }) => o.id);
    // every owner appears exactly once across the two pages, in id-asc order
    const seen = [...ids0, ...ids1];
    expect(seen.sort((a, b) => a - b)).toEqual([...created].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(6); // no repeats, no vanishes
    expect(ids0).toEqual([...created].sort((a, b) => a - b).slice(0, 3));
    expect(ids1).toEqual([...created].sort((a, b) => a - b).slice(3, 6));
  });
});
