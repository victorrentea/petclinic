import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  cleanDatabase,
  closeTestApp,
  createTestApp,
  ensureSchema,
  isDbAvailable,
} from './test-app';

/**
 * Ported from victor.training.petclinic.rest.ValidationErrorRenderingTest.
 *
 * Asserts the RFC-7807 ProblemDetail body carries a humanized `errors[]` array
 * with exactly one entry per failed constraint (mirroring the Java
 * ValidationErrorExtractor output).
 */
describe('Validation error rendering (e2e)', () => {
  let app: INestApplication;
  let available = false;

  beforeAll(async () => {
    available = await isDbAvailable();
    if (!available) return;
    await ensureSchema();
    app = await createTestApp();
  });

  afterAll(async () => {
    if (available) await closeTestApp();
  });

  beforeEach(async () => {
    if (!available) return;
    await cleanDatabase();
  });

  const http = () => request(app.getHttpServer());

  it('createOwner_withTwoValidationErrors_rendersErrorsArray', async () => {
    if (!available) return;
    // Two problems: empty firstName (@Length) + non-numeric telephone (@Matches).
    const payload = {
      firstName: '',
      lastName: 'Smith',
      address: '1 Road',
      city: 'Town',
      telephone: 'abc',
    };

    const res = await http().post('/api/owners').send(payload).expect(400);

    // RFC-7807 ProblemDetail shape (mirrors ExceptionControllerAdvice).
    expect(res.body.status).toBe(400);
    expect(res.body.title).toBe('Validation Error');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors).toHaveLength(2);
    // Humanized messages, one per failed constraint.
    expect(res.body.errors.some((e: string) => e.startsWith('First name'))).toBe(true);
    expect(res.body.errors.some((e: string) => e.startsWith('Telephone'))).toBe(true);
  });
});
