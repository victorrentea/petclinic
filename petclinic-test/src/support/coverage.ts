import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import type {Page} from '@playwright/test';

// Per-test coverage of a browser run, for /human-review's `testcov` step: which lines of
// the change each test actually executes, on both sides of the wire.
//
// Off unless COVERAGE_DIR is set — a normal run pays nothing. test-on-own-stack.sh sets
// the rest when it is: it starts the stack with `start-docker.sh up --jacoco`, whose
// backend carries JaCoCo's agent in tcpserver mode, and exports JACOCO_ADDRESS.
//
// Per test, and therefore serial: the backend's counters are one global set, so a dump
// taken while two tests run is two tests' lines under one name. playwright.config.ts
// drops to one worker when COVERAGE_DIR is set; cucumber-js is serial already.
//
// What lands in COVERAGE_DIR/<suite>/:
//   run.json             when the run started and against which commit
//   <slug>.json          one test: id, title, file, line, status, and Chromium's own
//                        precise JS coverage of the app's scripts during that test
//   <slug>.exec          the backend's JaCoCo execution data for that test alone
//   scripts/<hash>.json  each app script once: its URL, its source and its source map,
//                        which is what turns a covered byte offset back into a line of TS
//                        or of a template
// The skill turns those into covered lines; nothing here knows what changed.

export const COVERAGE_DIR = process.env.COVERAGE_DIR || '';

/** Starts a suite's run: its folder wiped, so a test that no longer exists cannot outlive it. */
export function startCoverageRun(suite: string): void {
  if (!COVERAGE_DIR) return;
  const dir = path.join(COVERAGE_DIR, suite);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(path.join(dir, 'scripts'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({
    suite,
    commit: process.env.HUMAN_REVIEW_APP_COMMIT || process.env.COVERAGE_COMMIT || '',
    startedAt: new Date().toISOString(),
    jacoco: process.env.JACOCO_ADDRESS || '',
  }, null, 1));
}

/** Before the test body: the backend's counters zeroed, the browser's switched on. */
export async function startTestCoverage(page: Page): Promise<void> {
  if (!COVERAGE_DIR) return;
  // What ran before this test — the previous test's teardown, a Before hook, the boot —
  // is thrown away rather than charged to the test about to start.
  await jacocoDump(true).catch(() => undefined);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', {callCount: true, detailed: true});
  sessions.set(page, cdp);
}

// A CDP session of our own rather than `page.coverage`: that API hands back every script's
// full source with the counts, and with `trace: 'on'` Playwright records the call's result
// into the trace — megabytes of bundle per test, which pushed every test past its timeout.
// The sources are fetched once per script instead (saveScript), straight from the server.
const sessions = new WeakMap<Page, import('@playwright/test').CDPSession>();

export interface TestMeta {
  suite: string;        // 'playwright' | 'cucumber'
  id: string;           // unique within the suite: file:line, plus the title for outlines
  title: string;
  file: string;         // relative to petclinic-test/
  line: number | null;
  status: string;
}

/** After the test body: both sides harvested under the test's name. Never throws — a
 *  coverage hiccup must not turn a green test red. */
export async function stopTestCoverage(page: Page | undefined, meta: TestMeta): Promise<void> {
  if (!COVERAGE_DIR || !page) return;
  const dir = path.join(COVERAGE_DIR, meta.suite);
  const slug = (meta.id + '-' + meta.title).replace(/[^A-Za-z0-9]+/g, '-').slice(0, 120);
  try {
    // The app's own scripts only: BASE_URL's origin, which is where the stack serves them.
    const origin = new URL(process.env.BASE_URL || page.url()).origin;
    const cdp = sessions.get(page);
    if (!cdp) return;
    const taken = await cdp.send('Profiler.takePreciseCoverage');
    await cdp.send('Profiler.stopPreciseCoverage');
    await cdp.detach().catch(() => undefined);
    const entries = taken.result
      .filter(e => e.url.startsWith(origin + '/') && /\.m?js(\?|$)/.test(e.url));
    for (const e of entries) await saveScript(dir, e.url);
    fs.writeFileSync(path.join(dir, slug + '.json'), JSON.stringify({
      ...meta,
      v8: entries.map(e => ({url: e.url, functions: e.functions})),
    }));
  } catch (err) {
    console.warn(`[coverage] no browser coverage for ${meta.id}: ${err}`);
  }
  try {
    const exec = await jacocoDump(true);
    if (exec) fs.writeFileSync(path.join(dir, slug + '.exec'), exec);
  } catch (err) {
    console.warn(`[coverage] no backend coverage for ${meta.id}: ${err}`);
  }
}

const saved = new Set<string>();

// Once per script and run: the bundle is the same bytes for every test, only which of them
// ran differs. The map is asked of the server that served the script — the Docker build
// emits hidden maps (angular.json, docker configuration), referenced by nothing, so the
// browser never loads them and a reader of the app never sees them.
async function saveScript(dir: string, url: string): Promise<void> {
  if (saved.has(url)) return;
  saved.add(url);
  const name = Buffer.from(url).toString('base64url').slice(-80);
  let source = '';
  try {
    const r = await fetch(url);
    if (r.ok) source = await r.text();
  } catch {
    source = '';
  }
  if (!source) return;
  let map: unknown = null;
  try {
    const r = await fetch(url.replace(/\?.*$/, '') + '.map');
    if (r.ok) map = await r.json();
  } catch {
    map = null;
  }
  fs.writeFileSync(path.join(dir, 'scripts', name + '.json'), JSON.stringify({url, source, map}));
}

// ---------------------------------------------------------------------------------------
// JaCoCo's agent, spoken to over its own TCP protocol (org.jacoco.core.runtime
// RemoteControlWriter/Reader): a header each way, one dump command, then execution data
// blocks until CMDOK. Everything before CMDOK is, byte for byte, an .exec file.

const BLOCK_HEADER = 0x01, BLOCK_SESSIONINFO = 0x10, BLOCK_EXECUTIONDATA = 0x11;
const BLOCK_CMDOK = 0x20, BLOCK_CMDDUMP = 0x40;

/** Dump (and optionally reset) the agent's counters. Resolves to the .exec bytes, or
 *  null when no agent is configured. */
export function jacocoDump(reset: boolean): Promise<Buffer | null> {
  const address = process.env.JACOCO_ADDRESS;
  if (!address) return Promise.resolve(null);
  const [host, port] = address.includes(':') ? address.split(':') : ['127.0.0.1', address];
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = net.connect(Number(port), host, () => {
      socket.write(Buffer.from([BLOCK_HEADER, 0xc0, 0xc0, 0x10, 0x07,
        BLOCK_CMDDUMP, 1, reset ? 1 : 0]));
    });
    socket.setTimeout(15_000, () => socket.destroy(new Error('JaCoCo agent timed out')));
    socket.on('data', (d: Buffer) => {
      chunks.push(d);
      const buf = Buffer.concat(chunks);
      let end: number;
      try {
        end = execEnd(buf);
      } catch (err) {
        socket.destroy();
        reject(err);
        return;
      }
      if (end >= 0) {
        socket.end();
        resolve(buf.subarray(0, end));
      }
    });
    socket.on('error', reject);
    socket.on('close', () => reject(new Error('JaCoCo agent closed the connection early')));
  });
}

/** Where CMDOK sits in `buf` once the whole answer is in, else -1. */
function execEnd(buf: Buffer): number {
  let i = 5;                                   // past the agent's own header block
  if (buf.length < i) return -1;
  const need = (n: number) => i + n <= buf.length;
  const utf = () => {
    if (!need(2)) return false;
    const n = buf.readUInt16BE(i);
    i += 2;
    if (!need(n)) return false;
    i += n;
    return true;
  };
  const varint = () => {
    let v = 0, shift = 0;
    for (;;) {
      if (!need(1)) return -1;
      const b = buf[i++];
      v |= (b & 0x7f) << shift;
      if (!(b & 0x80)) return v;
      shift += 7;
    }
  };
  while (need(1)) {
    const block = buf[i++];
    if (block === BLOCK_CMDOK) return i - 1;
    if (block === BLOCK_SESSIONINFO) {
      if (!utf() || !need(16)) return -1;
      i += 16;
    } else if (block === BLOCK_EXECUTIONDATA) {
      if (!need(8)) return -1;
      i += 8;
      if (!utf()) return -1;
      const n = varint();
      if (n < 0) return -1;
      const bytes = Math.ceil(n / 8);
      if (!need(bytes)) return -1;
      i += bytes;
    } else if (block === BLOCK_HEADER) {
      if (!need(4)) return -1;
      i += 4;
    } else {
      throw new Error(`unexpected JaCoCo block 0x${block.toString(16)}`);
    }
  }
  return -1;
}
