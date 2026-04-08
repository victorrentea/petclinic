import { chromium, webkit } from 'playwright';

const URL = 'http://host.docker.internal:4200/';
const OUT  = '/screenshots';

async function snap(browser, name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Proxy backend API calls server-side to bypass CORS: localhost:8080 → host.docker.internal:8080
  await page.route(/localhost:8080/, async route => {
    const origUrl = route.request().url();
    const url = origUrl.replace('localhost:8080', 'host.docker.internal:8080');
    console.log(`  [proxy] ${origUrl} → ${url}`);
    try {
      const headers = { ...route.request().headers() };
      delete headers['origin'];
      delete headers['referer'];
      const response = await route.fetch({ url, headers });
      await route.fulfill({ response });
    } catch (e) {
      console.error(`  [proxy error] ${e.message}`);
      await route.abort();
    }
  });
  await page.goto(URL + 'owners', { waitUntil: 'load', timeout: 30000 });
  // Wait for Angular's 500ms debounce + HTTP response + rendering
  try {
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
  } catch (e) {
    console.warn(`⚠ table rows not found for ${name}: ${e.message.split('\n')[0]}`);
  }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✓ ${name}`);
  await browser.close();
}

console.log('Taking screenshots…');

await snap(await chromium.launch(),                         'chrome');
await snap(await chromium.launch({ channel: 'msedge' }),   'edge');
await snap(await webkit.launch(),                           'safari');

console.log('Done.');
