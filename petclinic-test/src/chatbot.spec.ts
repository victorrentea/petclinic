import {test, expect} from './support/trace-fixture';

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
    await page.goto(CHATBOT_URL);

    // Identity is derived from the Bearer JWT and rendered read-only, right-aligned, no "Name" label.
    // The name/email below are the claims of the page's DEMO_JWT — change both together.
    await expect(page.locator('#assistantUser')).toHaveText('Kevin McCallister');
    await expect(page.locator('#assistantEmail')).toContainText('kevin.mccallister@petclinic.example');
    // It must NOT be an <input> anymore (was giving the impression it was editable).
    await expect(page.locator('input#assistantUser')).toHaveCount(0);
  });

  test('answers a triage question without a server error', async ({ page }) => {
    await page.goto(CHATBOT_URL);

    await page.fill('#assistantInput', "My dog Leo is limping and won't put weight on his leg");
    await page.click('#assistantSend');

    // The reply streams in progressively into the last assistant bubble.
    const reply = page.locator('#messageHistory .message.assistant').last();
    await expect
      .poll(async () => (await reply.innerText()).trim().length, { timeout: 90_000 })
      .toBeGreaterThan(20);

    // Regression guard for the 500 we just fixed: the bubble must not show an error.
    await expect(reply).not.toContainText(/Error:/i);
  });
});
