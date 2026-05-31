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

/**
 * End-to-end tests for the pet-types endpoints.
 */
describe('PetTypeController (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let available = false;

  let petTypeId: number;

  beforeAll(async () => {
    available = await isDbAvailable();
    if (!available) return;
    await ensureSchema();
    app = await createTestApp();
    ds = getDataSource();
  });

  afterAll(async () => {
    if (available) await closeTestApp();
  });

  beforeEach(async () => {
    if (!available) return;
    await cleanDatabase();
    petTypeId = (await savePetType(ds, 'cat')).id;
  });

  const http = () => request(app.getHttpServer());

  it('getPetType_ok', async () => {
    if (!available) return;
    const res = await http().get(`/api/pettypes/${petTypeId}`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.id).toBe(petTypeId);
    expect(res.body.name).toBe('cat');
  });

  it('getPetType_notFound', async () => {
    if (!available) return;
    await http().get('/api/pettypes/99999').expect(404);
  });

  it('getAllPetTypes', async () => {
    if (!available) return;
    const res = await http().get('/api/pettypes').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const match = res.body.find((t: { id: number }) => t.id === petTypeId);
    expect(match).toMatchObject({ id: petTypeId, name: 'cat' });
  });

  it('createPetType_ok (201 + Location, then readable)', async () => {
    if (!available) return;
    const res = await http().post('/api/pettypes').send({ name: 'rabbit' }).expect(201);
    const location = res.headers['location'];
    expect(location).toMatch(/^\/api\/pettypes\/\d+$/);
    const newId = Number(location.substring(location.lastIndexOf('/') + 1));
    const got = await http().get(`/api/pettypes/${newId}`).expect(200);
    expect(got.body.name).toBe('rabbit');
  });

  it('createPetType_invalid (empty name)', async () => {
    if (!available) return;
    await http().post('/api/pettypes').send({ name: '' }).expect(400);
  });

  it('updatePetType_ok', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/pettypes/${petTypeId}`).expect(200)).body;
    existing.name = 'cat II';
    await http().put(`/api/pettypes/${petTypeId}`).send(existing).expect(200);

    const updated = (await http().get(`/api/pettypes/${petTypeId}`).expect(200)).body;
    expect(updated.name).toBe('cat II');
  });

  it('updatePetType_invalid (empty name)', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/pettypes/${petTypeId}`).expect(200)).body;
    existing.name = '';
    await http().put(`/api/pettypes/${petTypeId}`).send(existing).expect(400);
  });

  it('deletePetType_ok (204)', async () => {
    if (!available) return;
    await http().delete(`/api/pettypes/${petTypeId}`).expect(204);
    await http().get(`/api/pettypes/${petTypeId}`).expect(404);
  });

  it('deletePetType_notFound', async () => {
    if (!available) return;
    await http().delete('/api/pettypes/99999').expect(404);
  });

  it('deletePetType_inUse_returnsServerError', async () => {
    if (!available) return;
    // Create an owner + pet referencing the petType -> FK constraint on delete.
    const owner = await saveOwner(ds);
    const { PetType } = await import('../src/pet-types/pet-type.entity');
    const seededType = await ds.getRepository(PetType).findOneByOrFail({ id: petTypeId });
    await savePet(ds, owner, seededType);

    const res = await http().delete(`/api/pettypes/${petTypeId}`).expect(500);
    expect(JSON.stringify(res.body)).toContain(
      'PetType is in use by existing pets and cannot be deleted',
    );
  });
});
