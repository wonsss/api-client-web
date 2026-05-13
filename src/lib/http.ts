import type { ApiRequest, ResponseData, TestResult } from '../types';
import { interpolate, applyPathVariables } from './utils';

function buildUrl(request: ApiRequest, vars: Record<string, string>): string {
  let url = interpolate(request.url, vars);
  const pathVarMap = Object.fromEntries(
    request.pathVariables.filter((p) => p.enabled && p.key).map((p) => [p.key, p.value])
  );
  url = applyPathVariables(url, pathVarMap);
  const enabled = request.params.filter((p) => p.enabled && p.key);
  if (enabled.length === 0) return url;
  const qs = enabled
    .map((p) => `${encodeURIComponent(interpolate(p.key, vars))}=${encodeURIComponent(interpolate(p.value, vars))}`)
    .join('&');
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
}

function buildHeaders(request: ApiRequest, vars: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const h of request.headers) {
    if (h.enabled && h.key) {
      headers[interpolate(h.key, vars)] = interpolate(h.value, vars);
    }
  }
  if (request.body.type === 'json' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (request.body.type === 'form' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  return headers;
}

function runScript(
  script: string,
  context: { request: ApiRequest; response?: ResponseData; env: Record<string, string> }
): { testResults: TestResult[]; envUpdates: Record<string, string> } {
  const testResults: TestResult[] = [];
  const envUpdates: Record<string, string> = {};

  if (!script.trim()) return { testResults, envUpdates };

  const pm = {
    test: (name: string, fn: () => void) => {
      try {
        fn();
        testResults.push({ name, passed: true });
      } catch (e: unknown) {
        testResults.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
    expect: (actual: unknown) => ({
      to: {
        equal: (expected: unknown) => {
          if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        },
        include: (substr: string) => {
          if (!String(actual).includes(substr)) throw new Error(`Expected "${actual}" to include "${substr}"`);
        },
        be: {
          ok: () => { if (!actual) throw new Error(`Expected truthy, got ${actual}`); },
          a: (type: string) => { if (typeof actual !== type) throw new Error(`Expected type ${type}, got ${typeof actual}`); },
          below: (n: number) => { if ((actual as number) >= n) throw new Error(`Expected ${actual} < ${n}`); },
          above: (n: number) => { if ((actual as number) <= n) throw new Error(`Expected ${actual} > ${n}`); },
        },
      },
    }),
    response: context.response
      ? {
          status: context.response.status,
          statusText: context.response.statusText,
          headers: context.response.headers,
          json: () => JSON.parse(context.response!.body),
          text: () => context.response!.body,
        }
      : undefined,
    environment: {
      get: (key: string) => context.env[key],
      set: (key: string, value: string) => { envUpdates[key] = value; },
    },
  };

  try {
    // eslint-disable-next-line no-new-func
    new Function('pm', script)(pm);
  } catch (e: unknown) {
    testResults.push({ name: 'Script Error', passed: false, error: e instanceof Error ? e.message : String(e) });
  }

  return { testResults, envUpdates };
}

function buildCurlCommand(method: string, url: string, headers: Record<string, string>, body?: string): string {
  const esc = (s: string) => s.replace(/'/g, "'\\''");
  const parts: string[] = [
    `curl --request ${method}`,
    `  --url '${esc(url)}'`,
  ];
  for (const [k, v] of Object.entries(headers)) {
    parts.push(`  --header '${esc(k)}: ${esc(v)}'`);
  }
  if (body) {
    parts.push(`  --data '${esc(body)}'`);
  }
  return parts.join(' \\\n');
}

export interface RequestResult {
  response: ResponseData;
  testResults: TestResult[];
  resolvedUrl: string;
  sentHeaders: Record<string, string>;
  curlCommand: string;
}

export async function executeRequest(
  request: ApiRequest,
  envVars: Record<string, string>,
  proxyUrl = '/api/proxy'
): Promise<RequestResult> {
  const { envUpdates: preEnvUpdates } = runScript(request.preRequestScript, { request, env: envVars });
  const mergedVars = { ...envVars, ...preEnvUpdates };

  const resolvedUrl = buildUrl(request, mergedVars);
  const sentHeaders = buildHeaders(request, mergedVars);

  let body: string | undefined;
  if (request.body.type !== 'none' && request.body.content) {
    body = interpolate(request.body.content, mergedVars);
  }

  const start = Date.now();
  let status: number;
  let statusText: string;
  let responseHeaders: Record<string, string>;
  let responseText: string;

  try {
    if (import.meta.env.DEV) {
      const raw = await fetch(resolvedUrl, {
        method: request.method,
        headers: sentHeaders,
        body: body != null ? body : undefined,
      });
      status = raw.status;
      statusText = raw.statusText;
      responseHeaders = {};
      raw.headers.forEach((value, key) => { responseHeaders[key] = value; });
      responseText = await raw.text();
    } else {
      const proxyRes = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: resolvedUrl, method: request.method, headers: sentHeaders, body }),
      });
      const data = await proxyRes.json() as {
        status: number; statusText: string; headers: Record<string, string>; body: string; error?: string;
      };
      if (data.error) throw new Error(data.error);
      status = data.status;
      statusText = data.statusText;
      responseHeaders = data.headers;
      responseText = data.body;
    }
  } catch (e: unknown) {
    return {
      response: {
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: e instanceof Error ? e.message : String(e),
        duration: Date.now() - start,
        size: 0,
      },
      testResults: [],
      resolvedUrl,
      sentHeaders,
      curlCommand: buildCurlCommand(request.method, resolvedUrl, sentHeaders, body),
    };
  }

  const duration = Date.now() - start;

  const response: ResponseData = {
    status,
    statusText,
    headers: responseHeaders,
    body: responseText,
    duration,
    size: new TextEncoder().encode(responseText).length,
  };

  const { testResults } = runScript(request.testScript, { request, response, env: mergedVars });

  return { response, testResults, resolvedUrl, sentHeaders, curlCommand: buildCurlCommand(request.method, resolvedUrl, sentHeaders, body) };
}
