import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { makeTestNameSpanProcessor } from './e2e-span-processor';

async function isCollectorReachable(): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 1000);
  try {
    const res = await fetch('/v1/traces', { method: 'POST', body: '', signal: ctl.signal });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

isCollectorReachable().then((up) => {
  if (!up) {
    console.info('ℹ️  OTel collector not reachable — frontend telemetry disabled.');
    return;
  }

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      'service.name': 'petclinic-frontend',
      'deployment.environment': 'local',
    }),
    spanProcessors: [
      makeTestNameSpanProcessor(
        () => (globalThis as any).__E2E_TEST_NAME__ as string | undefined,
      ),
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: '/v1/traces' }),
      ),
    ],
  });

  provider.register({ contextManager: new ZoneContextManager() });

  // e2e escape hatch: BatchSpanProcessor only exports every ~5s, but the test
  // runner closes the page the instant the last assertion passes — so the spans
  // that matter would be dropped before they ever leave the browser. The e2e
  // trace fixture calls this right before closing the page.
  (globalThis as any).__OTEL_FLUSH__ = () => provider.forceFlush();

  registerInstrumentations({
    instrumentations: [
      getWebAutoInstrumentations({
        // Page load emits documentFetch + one resourceFetch per bundle/asset, in a
        // trace of its own with no server span. Useful nowhere except load
        // profiling, and in a generated sequence diagram it is a whole section of
        // Browser -> Browser noise next to the round-trips the scenario is about.
        '@opentelemetry/instrumentation-document-load': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-fetch': {
          propagateTraceHeaderCorsUrls: [/localhost:8080/],
        },
        '@opentelemetry/instrumentation-xml-http-request': {
          propagateTraceHeaderCorsUrls: [/localhost:8080/],
        },
      }),
    ],
  });
});
