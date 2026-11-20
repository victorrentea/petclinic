import {expect, Locator, Page} from '@playwright/test';

/** The chatbot's own static page, served apart from the Angular app. */
export class AssistantPage {
  /** Who the page says is signed in — read-only text taken from the JWT. */
  readonly signedInUser: Locator;
  readonly signedInEmail: Locator;
  readonly question: Locator;
  readonly sendButton: Locator;
  /** The last bubble the assistant wrote; it fills in while the answer streams. */
  readonly lastReply: Locator;

  constructor(private readonly page: Page) {
    this.signedInUser = page.locator('#assistantUser');
    this.signedInEmail = page.locator('#assistantEmail');
    this.question = page.locator('#assistantInput');
    this.sendButton = page.locator('#assistantSend');
    this.lastReply = page.locator('#messageHistory .message.assistant').last();
  }

  static async open(page: Page, url: string): Promise<AssistantPage> {
    await page.goto(url);
    const assistant = new AssistantPage(page);
    await expect(assistant.question).toBeVisible();
    return assistant;
  }

  async ask(question: string): Promise<void> {
    await this.question.fill(question);
    await this.sendButton.click();
  }
}
