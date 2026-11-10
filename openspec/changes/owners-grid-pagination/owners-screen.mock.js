// Regenerates owners-screen.png: the real Owners page (stack running on :4200/:8080) with the proposal drawn in.
// cd petclinic-test && NODE_PATH=$PWD/node_modules node ../openspec/changes/owners-grid-pagination/owners-screen.mock.js ../openspec/changes/owners-grid-pagination/owners-screen.png
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:4200/owners');
  await p.waitForSelector('#ownersTable td.ownerFullName');
  await p.evaluate(async () => {
    const owners = await (await fetch('http://localhost:8080/api/owners')).json();
    const byId = Object.fromEntries(owners.map(o => [o.id, o]));
    const tbody = document.querySelector('#ownersTable tbody');
    const rows = [...tbody.children].filter(r => r.querySelector('td.ownerFullName'));
    const ownerOf = r => byId[r.querySelector('td.ownerFullName a').getAttribute('href').split('/').pop()];
    const cmp = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
    rows.sort((x, y) => { const a = ownerOf(x), c = ownerOf(y); return cmp(a.lastName, c.lastName) || cmp(a.firstName, c.firstName) || a.id - c.id; });
    tbody.innerHTML = '';
    rows.slice(0, 10).forEach(r => { const o = ownerOf(r); r.querySelector('td.ownerFullName a').textContent = `${o.lastName}, ${o.firstName}`; tbody.appendChild(r); });

    const ths = [...document.querySelectorAll('#ownersTable thead th')];
    const link = getComputedStyle(document.querySelector('td.ownerFullName a')).color;
    const sortable = (th, arrow) => { th.innerHTML = `<span style="color:${link};cursor:pointer;border-bottom:1px dashed ${link}">${th.textContent}</span> <span style="color:${link}">${arrow}</span>`; };
    sortable(ths[0], '▲'); sortable(ths[2], '<span style="opacity:.45">▲▼</span>');

    const addBtn = document.querySelector('#ownersTable button');
    const bar = addBtn.parentElement;
    bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:8px';
    const pager = document.createElement('div');
    pager.id = 'pager';
    pager.style.cssText = 'display:flex;align-items:center;gap:14px';
    pager.innerHTML = `
      <span>Rows per page:</span>
      <select class="form-control" style="width:auto;display:inline-block"><option>5</option><option selected>10</option><option>20</option></select>
      <span id="total" style="margin-left:10px">1 – 10 of 26</span>
      <span id="arrows"><button class="btn btn-default" disabled>‹</button> <button class="btn btn-default">›</button></span>`;
    bar.appendChild(pager);

    const mark = (el, n, dx = 6, dy = -12) => {
      const r = el.getBoundingClientRect();
      const m = document.createElement('div');
      m.textContent = n;
      m.style.cssText = `position:absolute;left:${r.right + window.scrollX + dx}px;top:${r.top + window.scrollY + dy}px;width:24px;height:24px;border-radius:12px;background:#d9480f;color:#fff;font:700 13px/24px sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.4);z-index:9999`;
      document.body.appendChild(m);
    };
    mark(ths[0].lastElementChild, 1, 4, -4); mark(ths[2].lastElementChild, 1, 4, -4);
    [1, 3, 4].forEach(i => mark(ths[i].firstChild.nodeType === 3 ? ths[i] : ths[i], 2, -ths[i].getBoundingClientRect().width + ths[i].textContent.length * 9 + 14, 6));
    mark(tbody.children[2].querySelector('td.ownerFullName a'), 3, 6, -4);
    mark(pager.querySelector('select'), 4, -10, -18);
    mark(pager.querySelector('#total'), 5, -66, -30);
    mark(pager.querySelector('#arrows'), 6, -10, -18);
    mark(document.querySelector('#search-owner-form button'), 7, 4, -12);
  });
  const h = await p.evaluate(() => document.querySelector('#pager').getBoundingClientRect().bottom + window.scrollY + 28);
  await p.screenshot({ path: process.argv[2], clip: { x: 0, y: 0, width: 1280, height: h } });
  await b.close();
})();
