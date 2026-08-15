import {test, expect} from '@playwright/test';
import {DetailCollector, DetailEntry} from './detail-index';

const entry = (text: string): DetailEntry => ({title: 't', steps: [{label: 'l', text}]});

// The N+1 queries these diagrams exist to expose are the same statement over and
// over; storing that statement once per arrow would be the payload, not the point.
test('the same detail twice is one entry under one id', () => {
  const collector = new DetailCollector();
  expect(collector.add(entry('select 1'))).toBe(collector.add(entry('select 1')));
  expect(collector.size).toBe(1);
});

test('different detail never shares an id', () => {
  const collector = new DetailCollector();
  expect(collector.add(entry('select 1'))).not.toBe(collector.add(entry('select 2')));
  expect(collector.size).toBe(2);
});

test('the index round-trips what was collected', () => {
  const collector = new DetailCollector();
  const id = collector.add(entry('select 1'));
  const index = collector.toIndex();
  expect(index.version).toBe(1);
  expect(index.details[id]).toEqual(entry('select 1'));
});

// The id ends up inside the arrow's label text, which a reader may well read;
// it also has to survive a URL, a shell and a JSON key untouched.
test('an id is plain lowercase alphanumerics', () => {
  const collector = new DetailCollector();
  expect(collector.add(entry('select 1'))).toMatch(/^[a-z0-9]{7,}$/);
});
