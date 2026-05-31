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
import { saveSpecialty } from './fixtures';

/**
 * End-to-end tests for the specialties endpoints.
 */
describe('SpecialtyController (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let available = false;

  let specialtyId: number;

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
    specialtyId = (await saveSpecialty(ds, 'radiology')).id;
  });

  const http = () => request(app.getHttpServer());

  it('getByIdOk', async () => {
    if (!available) return;
    const res = await http().get(`/api/specialties/${specialtyId}`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.id).toBe(specialtyId);
    expect(res.body.name).toBe('radiology');
  });

  it('getById_notFound', async () => {
    if (!available) return;
    await http().get('/api/specialties/99999').expect(404);
  });

  it('getAll', async () => {
    if (!available) return;
    const res = await http().get('/api/specialties').expect(200);
    const match = res.body.find((s: { id: number }) => s.id === specialtyId);
    expect(match).toMatchObject({ id: specialtyId, name: 'radiology' });
  });

  it('create_ok (201)', async () => {
    if (!available) return;
    const res = await http().post('/api/specialties').send({ name: 'surgery' }).expect(201);
    expect(res.headers['location']).toMatch(/^\/api\/specialties\/\d+$/);
  });

  it('create_invalid (null name)', async () => {
    if (!available) return;
    await http().post('/api/specialties').send({ name: null }).expect(400);
  });

  it('update_ok', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/specialties/${specialtyId}`).expect(200)).body;
    existing.name = 'radiology II';
    await http().put(`/api/specialties/${specialtyId}`).send(existing).expect(200);

    const updated = (await http().get(`/api/specialties/${specialtyId}`).expect(200)).body;
    expect(updated.name).toBe('radiology II');
  });

  it('update_invalid (null name)', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/specialties/${specialtyId}`).expect(200)).body;
    existing.name = null;
    await http().put(`/api/specialties/${specialtyId}`).send(existing).expect(400);
  });

  it('delete_ok', async () => {
    if (!available) return;
    await http().delete(`/api/specialties/${specialtyId}`).expect(200);
    await http().get(`/api/specialties/${specialtyId}`).expect(404);
  });

  it('delete_notFound', async () => {
    if (!available) return;
    await http().delete('/api/specialties/9999').expect(404);
  });
});
