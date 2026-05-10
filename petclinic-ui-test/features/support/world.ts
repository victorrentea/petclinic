import {After, Before, setDefaultTimeout, setWorldConstructor, World, IWorldOptions} from '@cucumber/cucumber';
import {Browser, BrowserContext, chromium, Page} from '@playwright/test';

setDefaultTimeout(60_000);

export class PlaywrightWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;
  ownerId?: number;
  petId?: number;
  visitDescription?: string;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(PlaywrightWorld);

Before(async function (this: PlaywrightWorld) {
  this.browser = await chromium.launch({headless: !process.env.HEADED});
  this.context = await this.browser.newContext({baseURL: process.env.BASE_URL || 'http://localhost:4200'});
  this.page = await this.context.newPage();
});

After(async function (this: PlaywrightWorld) {
  await this.context?.close();
  await this.browser?.close();
});
