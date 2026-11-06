'use server';
import {
  context,
  propagation,
  trace,
  SpanStatusCode,
} from '@opentelemetry/api';

const headersSetter = {
  set(carrier: Headers, key: string, value: string) {
    carrier.set(key, value);
  },
};

export async function fetchWithTrace(
  input: string | URL,
  init: RequestInit = {},
) {
  const tracer = trace.getTracer('http-client');

  // Ensure there is a span active for the outbound call
  return tracer.startActiveSpan(
    `fetch ${typeof input === 'string' ? input : input.toString()}`,
    async (span) => {
      try {
        const headers = new Headers(init.headers);
        propagation.inject(context.active(), headers, headersSetter);

        const res = await fetch(input, { ...init, headers });

        span.setAttribute('http.status_code', res.status);
        if (res.status >= 400) {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }

        return res;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
