import {test, expect} from './support/trace-fixture';
import {AssistantPage} from './pages/AssistantPage';

// The chatbot is a separate static page + streaming API on its own port (default 8082).
// It must be running (./start-backend.sh + the chatbot app, with OPENAI_API_KEY on the server).
const CHATBOT_URL = process.env.CHATBOT_URL || 'http://localhost:8082';

test.describe('PetClinic Assistant (chatbot)', () => {
  // start-apps.ts brings up the database, the backend and the frontend -- not this. The
  // chatbot needs its own pgvector on :5433 and an OPENAI_API_KEY on the server, so on a
  // plain `npm test` there is nothing on :8082 and both specs used to fail with
  // ERR_CONNECTION_REFUSED. That is a missing precondition, not a regression, and a red
  // suite that is red for the same reason every day stops being read at all. Skip when
  // the port is closed; run in full the moment somebody starts the app.
  test.beforeAll(async () => {
    const up = await fetch(CHATBOT_URL, {signal: AbortSignal.timeout(2_000)})
      .then(() => true, () => false);
    test.skip(!up, `nothing is listening on ${CHATBOT_URL} — start the chatbot to run these`);
  });

  test('shows the signed-in owner from the JWT as read-only text (no editable name field)', async ({ page }) => {
    const assistant = await AssistantPage.open(page, CHATBOT_URL);

    // Identity is derived from the Bearer JWT and rendered read-only, right-aligned, no "Name" label.
    // The name/email below are the claims of the page's DEMO_JWT — change both together.
    await expect(assistant.signedInUser).toHaveText('Kevin McCallister');
    await expect(assistant.signedInEmail).toContainText('kevin.mccallister@petclinic.example');
    // It must NOT be an <input> anymore (was giving the impression it was editable).
    expect(await assistant.signedInUser.evaluate((el) => el.tagName)).not.toBe('INPUT');
  });

  test('answers a triage question without a server error', async ({ page }) => {
    const assistant = await AssistantPage.open(page, CHATBOT_URL);

    await assistant.ask("My dog Leo is limping and won't put weight on his leg");

    // The reply streams in progressively into the last assistant bubble.
    await expect
      .poll(async () => (await assistant.lastReply.innerText()).trim().length, { timeout: 90_000 })
      .toBeGreaterThan(20);

    // Regression guard for the 500 we just fixed: the bubble must not show an error.
    await expect(assistant.lastReply).not.toContainText(/Error:/i);
  });
});
