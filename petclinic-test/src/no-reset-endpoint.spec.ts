import {test, expect} from '@playwright/test';
import axios from 'axios';

// The review environment can put the demo database back to its seed, which is what makes a
// transcript deep link clickable more than once without piling up duplicate rows. That
// power is deliberately *outside* the application: a separate container in
// docker/docker-compose.yml, reachable only over the compose network, routed only by the
// nginx config baked into the frontend image.
//
// This is the guard on that boundary. A reset guarded by a Spring profile or a property
// would be one wrong value away from answering in production; the only way to keep the
// promise is for the backend to have no such route at all, in any profile. If somebody
// ever adds one for convenience, this fails — and the failure says why.
// The backend's own origin, not the frontend's. Through nginx /__reset is a real route —
// it is how the review environment reaches the sidecar — so pointing this at the frontend
// tests the opposite of what it means to.
const ROOT = process.env.BACKEND_URL
  || (process.env.API_BASE_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');

const FORBIDDEN = ['/__reset', '/api/__reset', '/reset', '/api/reset', '/actuator/reset'];

test.describe('the backend offers no way to wipe its data', () => {
  for (const path of FORBIDDEN) {
    test(`POST ${path} is not a route this application serves`, async () => {
      const res = await axios.post(`${ROOT}${path}`, {}, {validateStatus: () => true});
      expect(res.status,
        `${ROOT}${path} answered ${res.status}. A data-reset endpoint must never live ` +
        `in the backend — it belongs to the review environment's sidecar, which cannot ` +
        `be deployed with the app. (If ${ROOT} is the frontend rather than the backend, ` +
        `set BACKEND_URL: nginx routes /__reset there on purpose.)`).toBe(404);
    });
  }
});
