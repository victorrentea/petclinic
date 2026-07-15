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

  it('onEnd does not throw', () => {
    const proc = makeTestNameSpanProcessor(() => 'test');
    expect(() => proc.onEnd({} as any)).not.toThrow();
  });

  it('forceFlush resolves', async () => {
    const proc = makeTestNameSpanProcessor(() => undefined);
    await expectAsync(proc.forceFlush()).toBeResolved();
  });

  it('shutdown resolves', async () => {
    const proc = makeTestNameSpanProcessor(() => undefined);
    await expectAsync(proc.shutdown()).toBeResolved();
  });
});
