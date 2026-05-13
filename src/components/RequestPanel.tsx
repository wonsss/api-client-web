import { useState, useMemo, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../store';
import { executeRequest } from '../lib/http';
import { interpolate, applyPathVariables } from '../lib/utils';
import { KeyValueEditor } from './KeyValueEditor';
import type { HttpMethod, ApiRequest } from '../types';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const METHOD_BG: Record<HttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-blue-400',
  PUT: 'text-yellow-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-pink-400',
  OPTIONS: 'text-gray-400',
};

type Tab = 'path' | 'params' | 'headers' | 'body' | 'scripts';

export function RequestPanel() {
  const activeCollectionId = useAppStore((s) => s.activeCollectionId);
  const collections = useAppStore((s) => s.collections);
  const activeRequestId = useAppStore((s) => s.activeRequestId);
  const environments = useAppStore((s) => s.environments);
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId);
  const isLoading = useAppStore((s) => s.isLoading);
  const { updateRequest, setResponse, setResolvedUrl, setSentHeaders, setCurlCommand, setTestResults, setLoading, pushHistory } = useAppStore();

  const request = useMemo(
    () => collections.find((c) => c.id === activeCollectionId)?.requests.find((r) => r.id === activeRequestId) ?? null,
    [collections, activeCollectionId, activeRequestId]
  );

  const envVars = useMemo<Record<string, string>>(() => {
    const env = environments.find((e) => e.id === activeEnvironmentId);
    if (!env) return {};
    return Object.fromEntries(
      env.variables
        .filter((v) => v.enabled && v.key)
        .map((v) => [v.key.replace(/^\{\{|\}\}$/g, '').trim(), v.value])
    );
  }, [environments, activeEnvironmentId]);

  const [tab, setTab] = useState<Tab>('params');
  const [requestName, setRequestName] = useState('');
  const [editingName, setEditingName] = useState(false);

  const prevRequestId = useRef<string | null>(null);
  useEffect(() => {
    if (!request || request.id === prevRequestId.current) return;
    prevRequestId.current = request.id;
    if (request.pathVariables.some((p) => p.key)) setTab('path');
    else setTab('params');
  }, [request?.id]);

  const previewUrl = useMemo(() => {
    if (!request?.url) return '';
    const pathVarMap = Object.fromEntries(
      (request.pathVariables ?? []).filter((p) => p.enabled && p.key).map((p) => [p.key, p.value || `{${p.key}}`])
    );
    return applyPathVariables(interpolate(request.url, envVars), pathVarMap);
  }, [request?.url, request?.pathVariables, envVars]);

  if (!request) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Select a request or create a new one
      </div>
    );
  }

  const update = (patch: Partial<ApiRequest>) => {
    if (!activeCollectionId) return;
    updateRequest(activeCollectionId, { ...request, ...patch });
  };

  const handleSend = async () => {
    if (!request.url.trim()) return;
    console.log('[API Client] envVars:', envVars, '| activeEnvironmentId:', activeEnvironmentId);
    setLoading(true);
    setResponse(null);
    setResolvedUrl(null);
    setSentHeaders(null);
    setCurlCommand(null);
    setTestResults([]);
    try {
      const { response, testResults, resolvedUrl, sentHeaders, curlCommand } = await executeRequest(request, envVars);
      setResponse(response);
      setResolvedUrl(resolvedUrl);
      setSentHeaders(sentHeaders);
      setCurlCommand(curlCommand);
      setTestResults(testResults);
      pushHistory({
        method: request.method,
        url: resolvedUrl,
        requestName: request.name,
        status: response.status,
        duration: response.duration,
      });
    } finally {
      setLoading(false);
    }
  };

  const pathVarCount = request.pathVariables.filter((p) => p.key).length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    ...(pathVarCount > 0 ? [{ id: 'path' as Tab, label: 'Path', badge: pathVarCount }] : []),
    { id: 'params', label: 'Params', badge: request.params.filter((p) => p.enabled && p.key).length || undefined },
    { id: 'headers', label: 'Headers', badge: request.headers.filter((h) => h.enabled && h.key).length || undefined },
    { id: 'body', label: 'Body' },
    { id: 'scripts', label: 'Scripts' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Request name */}
      <div className="px-4 pt-3 pb-1">
        {editingName ? (
          <input
            autoFocus
            value={requestName}
            onChange={(e) => setRequestName(e.target.value)}
            onBlur={() => { update({ name: requestName || request.name }); setEditingName(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { update({ name: requestName || request.name }); setEditingName(false); }
              if (e.key === 'Escape') setEditingName(false);
            }}
            className="bg-transparent text-gray-100 font-semibold text-sm border-b border-blue-500 focus:outline-none"
          />
        ) : (
          <span
            className="text-gray-300 text-sm font-semibold cursor-pointer hover:text-white"
            onClick={() => { setRequestName(request.name); setEditingName(true); }}
          >
            {request.name}
          </span>
        )}
      </div>

      {/* URL bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        <select
          value={request.method}
          onChange={(e) => update({ method: e.target.value as HttpMethod })}
          className={`bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm font-mono font-bold focus:outline-none focus:border-blue-500 ${METHOD_BG[request.method]}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="text-gray-200">{m}</option>
          ))}
        </select>
        <input
          value={request.url}
          onChange={(e) => update({ url: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="https://api.example.com/endpoint/{id}"
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 placeholder-gray-500 font-mono"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !request.url.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold px-4 py-1.5 rounded transition-colors"
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>

      {/* Env var 경고 / debug / resolved URL preview */}
      {request.url.includes('{{') && !activeEnvironmentId && (
        <div className="px-4 pb-1">
          <p className="text-xs text-yellow-500">⚠ 환경변수가 있지만 environment가 선택되지 않았습니다. 좌측 하단에서 선택하세요.</p>
        </div>
      )}
      {activeEnvironmentId && (
        <div className="px-4 pb-1 flex items-center gap-2 flex-wrap">
          {Object.keys(envVars).length === 0 ? (
            <span className="text-xs text-red-400">⚠ 선택된 환경에 저장된 변수가 없습니다. ⚙ 메뉴에서 다시 입력하세요.</span>
          ) : (
            Object.entries(envVars).map(([k, v]) => (
              <span key={k} className="text-xs bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 font-mono text-gray-300">
                <span className="text-blue-400">{k}</span>
                <span className="text-gray-500">=</span>
                <span className="text-green-400">{v.length > 30 ? v.slice(0, 30) + '…' : v}</span>
              </span>
            ))
          )}
        </div>
      )}
      {previewUrl && previewUrl !== request.url && activeEnvironmentId && Object.keys(envVars).length > 0 && (
        <div className="px-4 pb-1">
          <p className="text-xs text-gray-500 font-mono truncate" title={previewUrl}>
            <span className="text-gray-600 mr-1">→</span>{previewUrl}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-700 px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-xs px-3 py-2 border-b-2 transition-colors ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {t.label}
            {t.badge != null && (
              <span className="ml-1 bg-gray-600 text-gray-300 rounded-full px-1.5 text-xs">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === 'path' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400 mb-2">
              URL에서 감지된 path variables — <code className="text-yellow-400">{`{paramName}`}</code> 형식
            </p>
            {request.pathVariables.length === 0 ? (
              <p className="text-gray-500 text-xs">URL에 <code>{`{param}`}</code> 형식의 path variable이 없습니다.</p>
            ) : (
              request.pathVariables.map((pv) => (
                <div key={pv.id} className="flex items-center gap-2">
                  <span className="text-yellow-400 font-mono text-sm w-40 shrink-0">{`{${pv.key}}`}</span>
                  <input
                    value={pv.value}
                    placeholder="value"
                    onChange={(e) =>
                      update({
                        pathVariables: request.pathVariables.map((p) =>
                          p.id === pv.id ? { ...p, value: e.target.value } : p
                        ),
                      })
                    }
                    className="flex-1 bg-gray-700 text-gray-100 text-sm px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-500"
                  />
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'params' && (
          <KeyValueEditor
            items={request.params}
            onChange={(params) => update({ params })}
            keyPlaceholder="Parameter"
            valuePlaceholder="Value"
          />
        )}

        {tab === 'headers' && (
          <KeyValueEditor
            items={request.headers}
            onChange={(headers) => update({ headers })}
            keyPlaceholder="Header name"
            valuePlaceholder="Value"
          />
        )}

        {tab === 'body' && (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex gap-3">
              {(['none', 'json', 'form', 'text', 'xml'] as const).map((t) => (
                <label key={t} className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="radio"
                    name="bodyType"
                    value={t}
                    checked={request.body.type === t}
                    onChange={() => update({ body: { ...request.body, type: t } })}
                    className="accent-blue-500"
                  />
                  {t}
                </label>
              ))}
            </div>
            {request.body.type !== 'none' && (
              <div className="flex-1 min-h-[200px] border border-gray-600 rounded overflow-hidden">
                <Editor
                  height="100%"
                  language={request.body.type === 'json' ? 'json' : request.body.type === 'xml' ? 'xml' : 'plaintext'}
                  value={request.body.content}
                  onChange={(v) => update({ body: { ...request.body, content: v ?? '' } })}
                  theme="vs-dark"
                  options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'off', scrollBeyondLastLine: false }}
                />
              </div>
            )}
          </div>
        )}

        {tab === 'scripts' && (
          <div className="flex flex-col gap-4 h-full">
            <div>
              <div className="text-xs text-gray-400 mb-1">Pre-request Script</div>
              <div className="h-40 border border-gray-600 rounded overflow-hidden">
                <Editor
                  height="100%"
                  language="javascript"
                  value={request.preRequestScript}
                  onChange={(v) => update({ preRequestScript: v ?? '' })}
                  theme="vs-dark"
                  options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', scrollBeyondLastLine: false }}
                />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Test Script — <code className="text-blue-400">pm.test()</code>, <code className="text-blue-400">pm.expect()</code>, <code className="text-blue-400">pm.environment.set()</code></div>
              <div className="h-40 border border-gray-600 rounded overflow-hidden">
                <Editor
                  height="100%"
                  language="javascript"
                  value={request.testScript}
                  onChange={(v) => update({ testScript: v ?? '' })}
                  theme="vs-dark"
                  options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', scrollBeyondLastLine: false }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
