import { makeTestNameSpanProcessor } from './test-name-span-processor';

function fakeSpan() {
  const attrs: Record<string, unknown> = {};
  return {
    attrs,
    setAttribute(key: string, value: unknown) { this.attrs[key] = value; },
  };
}

describe('makeTestNameSpanProcessor', () => {
  it('stamps test.name on span start when a name is available', () => {
    const proc = makeTestNameSpanProcessor(() => 'add a visit');
    const span = fakeSpan();
    proc.onStart(span as any, {} as any);
    expect(span.attrs['test.name']).toBe('add a visit');
  });

  it('does nothing when no name is available', () => {
    const proc = makeTestNameSpanProcessor(() => undefined);
    const span = fakeSpan();
    proc.onStart(span as any, {} as any);
    expect(span.attrs['test.name']).toBeUndefined();
  });
});
