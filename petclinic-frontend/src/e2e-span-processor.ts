import { Context } from '@opentelemetry/api';
import { Span, SpanProcessor } from '@opentelemetry/sdk-trace-web';

// A no-op-by-default SpanProcessor that tags every started span with the current
// e2e test name, so traces can be filtered per-test in Tempo (TraceQL
// `{ span.test.name = "..." }`). Outside e2e runs getTestName() returns undefined
// and nothing is stamped.
export function makeTestNameSpanProcessor(
  getTestName: () => string | undefined,
): SpanProcessor {
  return {
    onStart(span: Span, _parentContext: Context): void {
      const name = getTestName();
      if (name) {
        span.setAttribute('test.name', name);
      }
    },
    onEnd(): void {},
    forceFlush(): Promise<void> { return Promise.resolve(); },
    shutdown(): Promise<void> { return Promise.resolve(); },
  };
}
