export function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key}}}`);
}

export function applyPathVariables(url: string, pathVars: Record<string, string>): string {
  return url.replace(/(?<!\{)\{([^{}]+)\}(?!\})/g, (_, key) => pathVars[key] ?? `{${key}}`);
}
