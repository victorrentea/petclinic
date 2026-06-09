import { test, expect } from '@playwright/test';

// The custom chatbot is a separate static page + streaming API on its own port (default 8082).
// It must be running (./start-backend.sh + the chatbot app, with OPENAI_API_KEY on the server).
const CHATBOT_URL = process.env.CHATBOT_URL || 'http://localhost:8082';

test.describe('PetClinic Assistant (custom chatbot)', () => {
  test('shows the signed-in owner from the JWT as read-only text (no editable name field)', async ({ page }) => {
    await page.goto(CHATBOT_URL);

    // Identity is derived from the Bearer JWT and rendered read-only, right-aligned, no "Name" label.
    await expect(page.locator('#assistantUser')).toHaveText('George Franklin');
    await expect(page.locator('#assistantEmail')).toContainText('george.franklin@petclinic.example');
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
