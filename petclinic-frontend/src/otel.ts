import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { makeTestNameSpanProcessor } from './e2e-span-processor';

// Neither the OTel Java agent nor the web instrumentations record HTTP payloads,
// yet the payload is half of what a REST round-trip means in a sequence diagram.
// The browser is the one place both sides are in hand, so capture them here and
// let the diagram generator decide whether to draw them (petclinic-test SEQ_HTTP_BODIES).
const MAX_BODY_CHARS = 4000;
const REQUEST_BODY = '__otelRequestBody__';

function clipBody(body: string): string {
  return body.length <= MAX_BODY_CHARS ? body : `${body.slice(0, MAX_BODY_CHARS)}…`;
}

// XHR hands the request body to send() and then forgets it — applyCustomAttributesOnSpan
// receives only the xhr — so stash it on the object on the way through.
const originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
  if (typeof body === 'string' && body) {
    (this as any)[REQUEST_BODY] = body;
  }
  return originalSend.call(this, body as any);
};

function captureBodies(span: { setAttribute: (k: string, v: string) => unknown }, xhr: XMLHttpRequest): void {
  const requestBody = (xhr as any)[REQUEST_BODY];
  if (typeof requestBody === 'string') {
    span.setAttribute('http.request.body', clipBody(requestBody));
  }
  try {
    // responseText throws when responseType is neither '' nor 'text'; Angular
    // asks for 'text' even on json requests, but a guard costs nothing.
    if (typeof xhr.responseText === 'string' && xhr.responseText) {
      span.setAttribute('http.response.body', clipBody(xhr.responseText));
    }
  } catch {
    // a non-text response body is nothing a sequence diagram wants to draw
  }
}

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
          applyCustomAttributesOnSpan: captureBodies,
        },
      }),
    ],
  });
});
