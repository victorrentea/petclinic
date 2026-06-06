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
import { savePet, savePetType, saveOwner, saveVet, saveVisit } from './fixtures';
import { todayIso } from './fixtures';
import { Pet } from '../src/pets/pet.entity';

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

  it('getById_returnsVisitsWithVet', async () => {
    if (!available) return;
    const pet = await ds.getRepository(Pet).findOneByOrFail({ id: petId });
    const vet = await saveVet(ds, 'Helen', 'Leary');
    await saveVisit(ds, pet, { description: 'rabies shot', vet });

    const res = await http().get(`/api/owners/${ownerId}`).expect(200);
    const visit = res.body.pets[0].visits[0];
    expect(visit.vetId).toBe(vet.id);
    expect(visit.vetFirstName).toBe('Helen');
    expect(visit.vetLastName).toBe('Leary');
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
    const match = res.body.find((o: { id: number }) => o.id === ownerId);
    expect(match).toMatchObject({ id: ownerId, firstName: 'George', lastName: 'Franklin' });
  });

  it('getAllWithLastNameFilter', async () => {
    if (!available) return;
    const owner2 = await saveOwner(ds, { lastName: 'Zephyrson' });
    const res = await http().get('/api/owners?lastName=Zephyr').expect(200);
    const match = res.body.find((o: { id: number }) => o.id === owner2.id);
    expect(match).toMatchObject({ id: owner2.id, lastName: 'Zephyrson' });
  });

  it('getAllWithNameFilter_notFound', async () => {
    if (!available) return;
    const res = await http().get('/api/owners?lastName=NonExistent').expect(200);
    expect(res.body).toEqual([]);
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
