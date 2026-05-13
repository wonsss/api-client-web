import { v4 as uuidv4 } from 'uuid';
import type { Collection, ApiRequest, HttpMethod, KeyValueItem } from '../types';

interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info?: { title?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, unknown> };
  definitions?: Record<string, unknown>;
}

interface OpenApiOperation {
  summary?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    content?: Record<string, { schema?: Record<string, unknown>; example?: unknown }>;
  };
  consumes?: string[];
  body?: unknown;
}

interface OpenApiParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'formData' | 'body';
  required?: boolean;
  example?: unknown;
  schema?: { example?: unknown; default?: unknown };
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function makeKV(key: string, value: string, enabled = true): KeyValueItem {
  return { id: uuidv4(), key, value, enabled };
}

function schemaToExample(schema: Record<string, unknown> | undefined): string {
  if (!schema) return '';
  if (schema.example !== undefined) return JSON.stringify(schema.example, null, 2);
  if (schema.type === 'object' && schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      obj[k] = v.example ?? v.default ?? (v.type === 'string' ? '' : v.type === 'number' ? 0 : null);
    }
    return JSON.stringify(obj, null, 2);
  }
  return '';
}

export function parseSwaggerSpec(json: string): Collection {
  const spec: OpenApiSpec = JSON.parse(json);
  const title = spec.info?.title ?? 'Imported Collection';
  const isV3 = !!spec.openapi;

  const requests: ApiRequest[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method.toLowerCase() as keyof typeof pathItem] as OpenApiOperation | undefined;
      if (!op) continue;

      const name = op.summary ?? op.operationId ?? `${method} ${path}`;
      const params: KeyValueItem[] = [];
      const headers: KeyValueItem[] = [];
      let bodyContent = '';
      let bodyType: ApiRequest['body']['type'] = 'none';

      for (const param of op.parameters ?? []) {
        const val = String(param.example ?? param.schema?.example ?? param.schema?.default ?? '');
        if (param.in === 'query') {
          params.push(makeKV(param.name, val, param.required ?? false));
        } else if (param.in === 'header') {
          headers.push(makeKV(param.name, val));
        }
      }

      if (isV3 && op.requestBody?.content) {
        const jsonContent = op.requestBody.content['application/json'];
        if (jsonContent) {
          bodyType = 'json';
          if (jsonContent.example !== undefined) {
            bodyContent = JSON.stringify(jsonContent.example, null, 2);
          } else {
            bodyContent = schemaToExample(jsonContent.schema as Record<string, unknown>);
          }
        }
      }

      requests.push({
        id: uuidv4(),
        name,
        method,
        url: `{{BASE_URL}}${path}`,
        headers,
        params,
        pathVariables: [],
        body: { type: bodyType, content: bodyContent },
        preRequestScript: '',
        testScript: '',
      });
    }
  }

  return { id: uuidv4(), name: title, requests };
}
