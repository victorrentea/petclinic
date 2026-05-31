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
import { saveVet } from './fixtures';

/**
 * End-to-end tests for the vets endpoints.
 */
describe('VetController (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let available = false;

  let vetId: number;

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
    vetId = (await saveVet(ds, 'James', 'Carter')).id;
  });

  const http = () => request(app.getHttpServer());

  it('getByIdOk', async () => {
    if (!available) return;
    const res = await http().get(`/api/vets/${vetId}`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.id).toBe(vetId);
    expect(res.body.firstName).toBe('James');
    expect(res.body.lastName).toBe('Carter');
  });

  it('getById_notFound', async () => {
    if (!available) return;
    await http().get('/api/vets/99999').expect(404);
  });

  // VetDto.id is read-only (@IsOptional), so a create body without an id is
  // accepted and the new vet gets a DB-generated id.
  it('create_ok (201)', async () => {
    if (!available) return;
    const res = await http()
      .post('/api/vets')
      .send({ firstName: 'Helen', lastName: 'Leary', specialties: [] })
      .expect(201);
    expect(res.headers['location']).toMatch(/^\/api\/vets\/\d+$/);
  });

  it('create_invalid (null firstName)', async () => {
    if (!available) return;
    await http()
      .post('/api/vets')
      .send({ firstName: null, lastName: 'Leary', specialties: [] })
      .expect(400);
  });

  it('update_ok', async () => {
    if (!available) return;
    const existing = (await http().get(`/api/vets/${vetId}`).expect(200)).body;
    existing.firstName = 'James Updated';
    await http().put(`/api/vets/${vetId}`).send(existing).expect(200);

    const updated = (await http().get(`/api/vets/${vetId}`).expect(200)).body;
    expect(updated.firstName).toBe('James Updated');
  });

  it('delete_ok', async () => {
    if (!available) return;
    await http().delete(`/api/vets/${vetId}`).expect(200);
    await http().get(`/api/vets/${vetId}`).expect(404);
  });

  it('delete_notFound', async () => {
    if (!available) return;
    await http().delete('/api/vets/9999').expect(404);
  });
});
