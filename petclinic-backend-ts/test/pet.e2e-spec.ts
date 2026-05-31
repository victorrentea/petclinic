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
 * Ported from victor.training.petclinic.rest.PetTest.
 */
describe('PetController (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let available = false;

  let petId: number;
  const BIRTH_DATE = '2010-10-10';

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
    const owner = await saveOwner(ds);
    const type = await savePetType(ds, 'cat');
    const pet = await savePet(ds, owner, type, { name: 'Leo', birthDate: BIRTH_DATE });
    petId = pet.id;
  });

  const http = () => request(app.getHttpServer());

  it('getByIdOk', async () => {
    if (!available) return;
    const res = await http().get(`/api/pets/${petId}`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.id).toBe(petId);
    expect(res.body.name).toBe('Leo');
    expect(res.body.type.name).toBe('cat');
    expect(res.body.birthDate).toBe(BIRTH_DATE);
  });

  it('getById_notFound', async () => {
    if (!available) return;
    await http().get('/api/pets/99999').expect(404);
  });

  it('getAll', async () => {
    if (!available) return;
    const res = await http().get('/api/pets').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    const match = res.body.find((p: { id: number }) => p.id === petId);
    expect(match.name).toBe('Leo');
    expect(match.type.name).toBe('cat');
    expect(match.birthDate).toBe(BIRTH_DATE);
  });

  it('update_ok (200)', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/pets/${petId}`).expect(200)).body;
    existing.name = 'Leo II';
    await http().put(`/api/pets/${petId}`).send(existing).expect(200);

    const updated = (await http().get(`/api/pets/${petId}`).expect(200)).body;
    expect(updated.name).toBe('Leo II');
  });

  it('update_invalid', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/pets/${petId}`).expect(200)).body;
    existing.name = ''; // invalid name (@IsNotEmpty)
    await http().put(`/api/pets/${petId}`).send(existing).expect(400);
  });

  it('update_notFound', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/pets/${petId}`).expect(200)).body;
    await http().put('/api/pets/99999').send(existing).expect(404);
  });

  it('delete_ok', async () => {
    if (!available) return;
    await http().delete(`/api/pets/${petId}`).expect(200);
    await http().get(`/api/pets/${petId}`).expect(404);
  });

  it('delete_notFound', async () => {
    if (!available) return;
    await http().delete('/api/pets/9999').expect(404);
  });
});
