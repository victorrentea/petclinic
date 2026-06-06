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
import { savePet, savePetType, saveOwner, saveVet, saveVisit, todayIso } from './fixtures';

/**
 * End-to-end tests for the visits endpoints.
 */
describe('VisitController (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let available = false;

  let visitId: number;
  let petId: number;
  let ownerData: { id: number; firstName?: string; lastName?: string };
  let petName: string;
  let vetData: { id: number; firstName?: string; lastName?: string };

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
    ownerData = { id: owner.id, firstName: owner.firstName, lastName: owner.lastName };
    const type = await savePetType(ds, 'dog');
    const pet = await savePet(ds, owner, type);
    petId = pet.id;
    petName = pet.name as string;
    const vet = await saveVet(ds, 'Helen', 'Leary');
    vetData = { id: vet.id, firstName: vet.firstName, lastName: vet.lastName };
    const visit = await saveVisit(ds, pet, { date: todayIso(), description: 'rabies shot', vet });
    visitId = visit.id;
  });

  const http = () => request(app.getHttpServer());

  it('getByIdOk', async () => {
    if (!available) return;
    const res = await http().get(`/api/visits/${visitId}`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.id).toBe(visitId);
    expect(res.body.description).toBe('rabies shot');
    expect(res.body.petId).toBe(petId);
    expect(res.body.vetId).toBe(vetData.id);
    expect(res.body.vetFirstName).toBe(vetData.firstName);
    expect(res.body.vetLastName).toBe(vetData.lastName);
  });

  it('getById_notFound', async () => {
    if (!available) return;
    await http().get('/api/visits/99999').expect(404);
  });

  it('getAll', async () => {
    if (!available) return;
    const res = await http().get('/api/visits').expect(200);
    const match = res.body.find((v: { id: number }) => v.id === visitId);
    expect(match).toMatchObject({ id: visitId, description: 'rabies shot' });
  });

  it('getAll_returnsEnrichedFields', async () => {
    if (!available) return;
    const res = await http().get('/api/visits').expect(200);
    const created = res.body.find((v: { id: number }) => v.id === visitId);
    expect(created.petName).toBe(petName);
    expect(created.ownerId).toBe(ownerData.id);
    expect(created.ownerFirstName).toBe(ownerData.firstName);
    expect(created.ownerLastName).toBe(ownerData.lastName);
    expect(created.vetId).toBe(vetData.id);
    expect(created.vetFirstName).toBe(vetData.firstName);
    expect(created.vetLastName).toBe(vetData.lastName);
  });

  it('create_ok (with vet) round-trips the vet', async () => {
    if (!available) return;
    const newVisit = { petId, vetId: vetData.id, date: todayIso(), description: 'checkup' };
    const res = await http().post('/api/visits').send(newVisit).expect(201);
    const location = res.headers.location as string;
    expect(location).toMatch(/^\/api\/visits\/\d+$/);
    const created = (await http().get(location).expect(200)).body;
    expect(created.vetId).toBe(vetData.id);
    expect(created.vetFirstName).toBe(vetData.firstName);
    expect(created.vetLastName).toBe(vetData.lastName);
  });

  it('create_invalid (missing description)', async () => {
    if (!available) return;
    const newVisit = { petId, vetId: vetData.id, date: todayIso() }; // missing description
    await http().post('/api/visits').send(newVisit).expect(400);
  });

  it('create_invalid (missing vetId)', async () => {
    if (!available) return;
    const newVisit = { petId, date: todayIso(), description: 'checkup' }; // missing vetId
    await http().post('/api/visits').send(newVisit).expect(400);
  });

  it('update_invalid (null description)', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/visits/${visitId}`).expect(200)).body;
    existing.description = null;
    await http().put(`/api/visits/${visitId}`).send(existing).expect(400);
  });

  it('update_changesVet', async () => {
    if (!available) return;
    const otherVet = await saveVet(ds, 'Rafael', 'Ortega');
    const body = { date: todayIso(), description: 'rabies shot', vetId: otherVet.id };
    await http().put(`/api/visits/${visitId}`).send(body).expect(200);
    const updated = (await http().get(`/api/visits/${visitId}`).expect(200)).body;
    expect(updated.vetId).toBe(otherVet.id);
    expect(updated.vetFirstName).toBe('Rafael');
    expect(updated.vetLastName).toBe('Ortega');
  });

  it('update_invalid (missing vetId)', async () => {
    if (!available) return;
    const body = { date: todayIso(), description: 'rabies shot' }; // missing vetId
    await http().put(`/api/visits/${visitId}`).send(body).expect(400);
  });

  it('delete_ok', async () => {
    if (!available) return;
    await http().delete(`/api/visits/${visitId}`).expect(200);
    await http().get(`/api/visits/${visitId}`).expect(404);
  });

  it('delete_notFound', async () => {
    if (!available) return;
    await http().delete('/api/visits/9999').expect(404);
  });
});
