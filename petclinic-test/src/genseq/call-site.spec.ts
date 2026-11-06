import {test, expect} from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {SourceMapConsumer, SourceMapGenerator} from 'source-map';
import {
  CALL_SITE_ATTRIBUTE, CallFrame, applicationFrames, callSiteHandle, callSiteIndex,
  idsOfTraceparent, parseStack, requestFrames, triggerOf, withCallSites,
} from './call-site';
import type {NormSpan} from './trace-to-puml';
import {CUCUMBER_SOURCES} from './generate';
import {readCallSites, saveCallSites} from '../support/call-sites';
import {forgetWindowsOf} from '../support/trace-window-store';

const BUNDLE = 'http://127.0.0.1:63285/main.5246b24f48d8b1e7.js';
const POLYFILLS = 'http://127.0.0.1:63285/polyfills.96561b4e147d79cf.js';
const COMPONENT = 'src/app/owners/owner-detail/owner-detail.component.ts';
const SOURCE = [
  'export class OwnerDetailComponent {',
  '  ngOnInit() {',
  '    this.ownerService.getOwnerById(ownerId).subscribe(',
  '      owner => this.owner = owner);',
  '  }',
  '}',
].join('\n');

/** A bundle of one minified line: column 100 is the app, column 200 rxjs, 300 a lib's own `src/app`. */
function bundleMap(sourceRoot = 'webpack:///', source = `./${COMPONENT}`): SourceMapConsumer {
  const map = new SourceMapGenerator({file: 'main.js', sourceRoot});
  map.addMapping({source, name: 'subscribe',
    generated: {line: 1, column: 99}, original: {line: 3, column: 44}});
  map.addMapping({source: './node_modules/rxjs/dist/esm/internal/Observable.js',
    generated: {line: 1, column: 199}, original: {line: 30, column: 4}});
  map.addMapping({source: './node_modules/some-lib/src/app/lib.ts',
    generated: {line: 1, column: 299}, original: {line: 7, column: 0}});
  map.setSourceContent(source, SOURCE);
  return new SourceMapConsumer(JSON.parse(map.toString()));
}

const stack = (...rows: string[]) => ['Error', ...rows.map((r) => `    at ${r}`)].join('\n');

test('the traceparent names the browser span the request left under', () => {
  expect(idsOfTraceparent('00-f74df0671d03f3d3848ffda9ac315932-eb4261e7b2160a89-01'))
    .toEqual({traceId: 'f74df0671d03f3d3848ffda9ac315932', spanId: 'eb4261e7b2160a89'});
  expect(idsOfTraceparent('not a traceparent')).toBeUndefined();
});

test('a stack reads top first, and a frame with no script position is skipped', () => {
  expect(parseStack(stack(
    'proto.send [as __zone_symbol__send] (<anonymous>:24:42)',
    `m.X [as scheduleFn] (${POLYFILLS}:1:32105)`,
    `${POLYFILLS}:1:32496`,
  ))).toEqual([
    {url: POLYFILLS, line: 1, column: 32105},
    {url: POLYFILLS, line: 1, column: 32496},
  ]);
});

test('only the application frames survive, at their original line', () => {
  const frames = applicationFrames(stack(
    `t.subscribe (${BUNDLE}:1:200)`, // rxjs
    `lib (${BUNDLE}:1:300)`,         // a library's own src/app
    `e.ngOnInit (${BUNDLE}:1:100)`,
  ), new Map([[BUNDLE, bundleMap()]]));
  expect(frames).toEqual([{
    file: COMPONENT, line: 3, text: 'this.ownerService.getOwnerById(ownerId).subscribe(',
  }]);
});

test('ng serve spells the source differently, and it is the same file', () => {
  const frames = applicationFrames(stack(`e.ngOnInit (${BUNDLE}:1:100)`),
    new Map([[BUNDLE, bundleMap('', `webpack:///./${COMPONENT}`)]]));
  expect(frames.map((f) => f.file)).toEqual([COMPONENT]);
});

test('a script with no map gives no frames rather than a position in minified code', () => {
  expect(applicationFrames(stack(`e.ngOnInit (${BUNDLE}:1:100)`), new Map())).toEqual([]);
});

test('two stack frames on one line are one frame', () => {
  const frames = applicationFrames(
    stack(`a (${BUNDLE}:1:100)`, `b (${BUNDLE}:1:101)`), new Map([[BUNDLE, bundleMap()]]));
  expect(frames).toHaveLength(1);
});

// The router's hop: a stack of 226 frames with no application frame, and the click that
// scheduled it one task earlier.
test('a request sent from application code never looks at what scheduled it', () => {
  const frames = requestFrames(
    [stack(`e.ngOnInit (${BUNDLE}:1:100)`), stack(`e.earlier (${BUNDLE}:1:100)`)],
    new Map([[BUNDLE, bundleMap()]]));
  expect(frames).toEqual([expect.not.objectContaining({deferred: true})]);
});

test('a request with no application frame takes the nearest stack that scheduled it', () => {
  const frames = requestFrames(
    [stack(`t.subscribe (${BUNDLE}:1:200)`), stack(`e.onSort (${BUNDLE}:1:100)`)],
    new Map([[BUNDLE, bundleMap()]]));
  expect(frames).toEqual([expect.objectContaining({file: COMPONENT, line: 3, deferred: true})]);
});

test('no stack with an application frame means no frames', () => {
  expect(requestFrames([stack(`t.subscribe (${BUNDLE}:1:200)`), 'Error'],
    new Map([[BUNDLE, bundleMap()]]))).toEqual([]);
});

const frame = (file: string, line = 1): CallFrame => ({file, line});

test('the trigger is the first application frame: the component that subscribed', () => {
  const component = frame('src/app/a/a.component.ts', 63);
  expect(triggerOf([component, frame('src/app/a/a.component.html', 25)])).toBe(component);
});

test('a service above a component yields to the component that called it', () => {
  const component = frame('src/app/a/a.component.ts');
  expect(triggerOf([frame('src/app/a/a.service.ts'), component])).toBe(component);
  expect(triggerOf([frame('src/app/http-error.interceptor.ts'), component])).toBe(component);
});

test('a deferred request links to the handler, not the helper every caller shares', () => {
  const file = 'src/app/visits/visits-page/visits-page.component.ts';
  const deferred = (f: string, line: number): CallFrame => ({file: f, line, deferred: true});
  const onSort = deferred(file, 63);
  expect(triggerOf([deferred(file, 86), onSort,
    deferred('src/app/visits/visits-page/visits-page.component.html', 15)])).toBe(onSort);
});

test('a service alone on the stack is still the best there is', () => {
  const service = frame('src/app/a/a.service.ts');
  expect(triggerOf([service])).toBe(service);
});

test('no application frame, no trigger', () => {
  expect(triggerOf([])).toBeUndefined();
});

const ROOT = '/repo';
const read = (files: Record<string, string>) => (p: string) => files[p];
const attribute = (frames: CallFrame[]) => JSON.stringify(frames);

test('the handle points at the confirmed line and says what the numbers are', () => {
  const frames = [
    {file: COMPONENT, line: 3, text: 'this.ownerService.getOwnerById(ownerId).subscribe('},
    {file: 'src/app/owners/owner-detail/owner-detail.component.html', line: 25},
  ];
  expect(callSiteHandle(attribute(frames), 'petclinic-frontend', ROOT,
    read({[`${ROOT}/petclinic-frontend/${COMPONENT}`]: SOURCE})))
    .toBe(`src://petclinic-frontend/${COMPONENT}:3`
      + '{Click to open the line that sent this request: '
      + 'owner-detail.component.ts:3 ← owner-detail.component.html:25}');
});

test('a line the checkout no longer has there gets no link, not the wrong one', () => {
  const frames = [{file: COMPONENT, line: 2, text: 'this.ownerService.getOwnerById(ownerId).subscribe('}];
  expect(callSiteHandle(attribute(frames), 'petclinic-frontend', ROOT,
    read({[`${ROOT}/petclinic-frontend/${COMPONENT}`]: SOURCE}))).toBeUndefined();
});

test('a file this checkout does not have gets no link', () => {
  expect(callSiteHandle(attribute([frame(COMPONENT)]), 'petclinic-frontend', ROOT, read({})))
    .toBeUndefined();
});

test('frames that cannot be read get no link', () => {
  expect(callSiteHandle('not json', 'petclinic-frontend', ROOT, read({}))).toBeUndefined();
  expect(callSiteHandle('[]', 'petclinic-frontend', ROOT, read({}))).toBeUndefined();
});

function span(over: Partial<NormSpan>): NormSpan {
  return {traceId: '', spanId: '', parentSpanId: '', name: 'GET', kind: 'CLIENT',
    serviceName: 'petclinic-frontend', startNano: 0, attributes: {}, ...over};
}

test('Tempo’s base64 ids meet the header’s hex ones on the browser span', () => {
  // Real ids from one run: 00-7c4ec1e2eb2f07d285a84ca5769679dd-96b94185f14defff-01
  const index = callSiteIndex([{
    traceId: '7c4ec1e2eb2f07d285a84ca5769679dd', spanId: '96b94185f14defff', frames: [frame(COMPONENT, 3)],
  }]);
  const [client, other] = withCallSites([
    span({traceId: 'fE7B4usvB9KFqEyldpZ53Q==', spanId: 'lrlBhfFN7/8='}),
    span({traceId: 'fE7B4usvB9KFqEyldpZ53Q==', spanId: 'AAAAAAAAAAA='}),
  ], index);
  expect(JSON.parse(client.attributes[CALL_SITE_ATTRIBUTE])).toEqual([frame(COMPONENT, 3)]);
  expect(other.attributes).toEqual({});
});

test('only the request span is stamped, and a request with no frames stays bare', () => {
  const ids = {traceId: '7c4ec1e2eb2f07d285a84ca5769679dd', spanId: '96b94185f14defff'};
  const located = callSiteIndex([{...ids, frames: [frame(COMPONENT)]}]);
  expect(withCallSites([span({...ids, kind: 'SERVER'})], located)[0].attributes).toEqual({});
  expect(withCallSites([span(ids)], callSiteIndex([{...ids, frames: []}]))[0].attributes).toEqual({});
});

// A Scenario Outline runs every row under one title, so one test can save twice in a run.
test('every row of an Outline adds to its file, and a runner forgets only its own', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'call-sites-'));
  const outline = {title: 'Filter owners', source: 'src/owner-search.feature'};
  const raw = (spanId: string) => ({
    traceparent: `00-7c4ec1e2eb2f07d285a84ca5769679dd-${spanId}-01`, stacks: ['Error'],
  });
  await saveCallSites(dir, outline, [raw('96b94185f14defff')]);
  await saveCallSites(dir, outline, [raw('96b94185f14deffe')]);
  await saveCallSites(dir, {title: 'Add a visit', source: 'src/add-visit.spec.ts'}, [raw('96b94185f14deffd')]);
  expect(readCallSites(dir).map((s) => s.spanId).sort())
    .toEqual(['96b94185f14deffd', '96b94185f14deffe', '96b94185f14defff']);

  forgetWindowsOf(dir, CUCUMBER_SOURCES);
  expect(readCallSites(dir).map((s) => s.spanId)).toEqual(['96b94185f14deffd']);
});
