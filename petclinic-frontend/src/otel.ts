import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { makeTestNameSpanProcessor } from './test-name-span-processor';

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

  registerInstrumentations({
    instrumentations: [
      getWebAutoInstrumentations({
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
