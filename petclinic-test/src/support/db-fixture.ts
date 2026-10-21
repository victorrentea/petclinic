import axios from 'axios';

// What the database holds when a test starts: the one thing a test must SAY rather than
// inherit. A Playwright spec says it with `test.use({dbFixture: 'default'})` (or the name of a
// db/fixtures/<name>.sql); a Cucumber feature or scenario with the tag `@fixture:default`.
// Saying nothing means 'empty' — every table emptied, the reference rows (pet types,
// specialties) written back — which is also what an undeclared Spring test starts on
// (petclinic-backend/src/test/resources/config/application.properties).
//
// The reset itself is the review environment's sidecar (docker/reset), reached through the
// frontend's nginx at /__reset — never the backend, which must not have such a route
// (no-reset-endpoint.spec.ts). So it exists only on a docker stack: `ng serve` on :4200 has no
// /__reset, and there a test runs on whatever the database holds, as every test did before.

export type DbFixture = 'empty' | 'default' | string;

/** Words of a tag or `dbFixture`, to the sidecar's route: Default is its root, the rest a name. */
function route(fixture: DbFixture): string {
  return fixture === 'default' || fixture === 'seed' ? '/__reset' : `/__reset/${fixture}`;
}

/** The fixture a Cucumber pickle declares with `@fixture:<name>`, else 'empty'. */
export function fixtureOfTags(tags: readonly {name: string}[]): DbFixture {
  const named = tags.map(t => /^@fixture[:=-]([a-z0-9][a-z0-9-]*)$/.exec(t.name)?.[1]).filter(Boolean);
  return (named[0] as string | undefined) ?? 'empty';
}

let warned = false;

/**
 * Puts the database on `fixture`. Returns false, once warned, when there is no sidecar to ask —
 * the stack is not a docker one — and throws when there is one and the reset fails: a test that
 * declared its data must not run on other data and pass for the wrong reason.
 */
export async function resetDatabaseTo(fixture: DbFixture): Promise<boolean> {
  const base = (process.env.BASE_URL || 'http://127.0.0.1:4200').replace(/\/$/, '');
  const res = await axios.post(base + route(fixture), {}, {
    timeout: 30_000, validateStatus: () => true, responseType: 'text', transformResponse: r => r,
  });
  let body: any;
  try { body = JSON.parse(res.data); } catch { body = undefined; }
  if ((res.status === 404 && !body) || (res.status < 400 && body?.ok === undefined)) {
    if (!warned) {
      warned = true;
      console.warn(`⚠️  no reset sidecar behind ${base}/__reset (not a docker stack): tests run on ` +
        `whatever the database holds, not on the DB fixture they declare.`);
    }
    return false;
  }
  if (!body?.ok) {
    throw new Error(`reset to DB fixture '${fixture}' failed (${res.status}): ${body?.error ?? res.data}`);
  }
  return true;
}
