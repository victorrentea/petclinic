#!/usr/bin/env node
// HTML mockups for OpenSpec proposals, built from the running app so they look like it.
//   capture <route> <out.html>  snapshot a live page (http://localhost:4200/petclinic/<route>)
//                               as standalone HTML: styles inlined, scripts dropped,
//                               fonts/images pointed at petclinic-frontend/src/assets
//   shot <page.html> <out.png>  screenshot an edited snapshot for the proposal
// Uses petclinic-test's Playwright; needs ./start-frontend.sh (and the backend) for `capture`.
const path = require('path');
const fs = require('fs');
const { chromium } = require(require.resolve('@playwright/test',
    { paths: [path.join(__dirname, '..', 'petclinic-test')] }));

const [command, source, target] = process.argv.slice(2);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 520 } });
    if (command === 'capture') {
        await page.goto(`http://localhost:4200/petclinic/${source}`);
        await page.waitForLoadState('networkidle');
        const assets = path.relative(path.dirname(path.resolve(target)),
            path.join(__dirname, '..', 'petclinic-frontend', 'src', 'assets'));
        fs.writeFileSync(target, await page.evaluate(snapshotHtml, assets));
    } else if (command === 'shot') {
        await page.goto('file://' + path.resolve(source));
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: target, fullPage: true });
    } else {
        console.error('usage: ui-mockup.cjs capture <route> <out.html> | shot <page.html> <out.png>');
        process.exitCode = 1;
    }
    await browser.close();
})();

function snapshotHtml(assets) {
    let css = '';
    for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) css += rule.cssText + '\n';
    }
    const doc = document.documentElement.cloneNode(true);
    doc.querySelectorAll('script, style, link[rel=stylesheet], base').forEach(e => e.remove());
    const style = document.createElement('style');
    style.textContent = css
        .replace(/url\("([\w-]+\.(?:ttf|woff2?|eot|svg))"\)/g, `url("${assets}/fonts/$1")`)
        .replace(/url\("([\w-]+\.png)"\)/g, `url("${assets}/images/$1")`);
    doc.querySelector('head').appendChild(style);
    const html = '<!doctype html>\n' + doc.outerHTML;
    return html.replace(/\s(_ngcontent|_nghost|ng-reflect)[\w-]*="[^"]*"/g, '');
}
