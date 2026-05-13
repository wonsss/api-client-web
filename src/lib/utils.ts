export function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key}}}`);
}

export function applyPathVariables(url: string, pathVars: Record<string, string>): string {
  return url.replace(/(?<!\{)\{([^{}]+)\}(?!\})/g, (_, key) => pathVars[key] ?? `{${key}}`);
}

export function extractTemplateVars(text: string): string[] {
  return [...text.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim());
}

import type { Collection } from '../types';

export function extractCollectionVars(collections: Collection[]): string[] {
  const vars = new Set<string>();
  for (const col of collections) {
    for (const req of col.requests) {
      const sources = [
        req.url,
        req.body.content,
        req.preRequestScript,
        req.testScript,
        ...req.headers.map((h) => h.value),
        ...req.params.map((p) => p.value),
      ];
      for (const src of sources) {
        for (const v of extractTemplateVars(src)) vars.add(v);
      }
    }
  }
  return [...vars].sort();
}
