import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../store';

type Tab = 'body' | 'headers' | 'request' | 'curl' | 'tests';

function statusColor(status: number) {
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-orange-400';
  if (status >= 300) return 'text-yellow-400';
  if (status >= 200) return 'text-green-400';
  return 'text-gray-400';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function detectLanguage(headers: Record<string, string>, body: string): string {
  const ct = headers['content-type'] ?? '';
  if (ct.includes('json') || body.trimStart().startsWith('{') || body.trimStart().startsWith('[')) return 'json';
  if (ct.includes('xml') || ct.includes('html')) return 'xml';
  return 'plaintext';
}

function tryPrettyJson(body: string) {
  try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; }
}

function HeaderTable({ entries, emptyMessage }: { entries: [string, string][]; emptyMessage?: string }) {
  if (entries.length === 0) {
    return <p className="text-gray-500 text-xs">{emptyMessage ?? 'No headers'}</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-400 border-b border-gray-700">
          <th className="text-left pb-2 font-medium w-1/3">Header</th>
          <th className="text-left pb-2 font-medium">Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-gray-800 hover:bg-gray-800">
            <td className="py-1.5 pr-4 text-blue-300 font-mono">{k}</td>
            <td className="py-1.5 text-gray-300 font-mono break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ResponsePanel() {
  const { response, resolvedUrl, sentHeaders, curlCommand, testResults, isLoading } = useAppStore();
  const [tab, setTab] = useState<Tab>('body');

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        <span className="animate-pulse">Sending request...</span>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Response will appear here
      </div>
    );
  }

  const lang = detectLanguage(response.headers, response.body);
  const body = lang === 'json' ? tryPrettyJson(response.body) : response.body;
  const passedCount = testResults.filter((t) => t.passed).length;
  const sentHeaderEntries = Object.entries(sentHeaders ?? {});

  const tabs = [
    { id: 'body' as Tab, label: 'Body' },
    { id: 'headers' as Tab, label: 'Response Headers', badge: Object.keys(response.headers).length },
    { id: 'request' as Tab, label: 'Request', badge: sentHeaderEntries.length || undefined },
    { id: 'curl' as Tab, label: 'cURL' },
    { id: 'tests' as Tab, label: 'Tests', badge: testResults.length > 0 ? `${passedCount}/${testResults.length}` : undefined },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="border-b border-gray-700">
        <div className="flex items-center gap-4 px-4 py-1.5">
          <span className={`text-sm font-bold font-mono ${statusColor(response.status)}`}>
            {response.status} {response.statusText}
          </span>
          <span className="text-xs text-gray-400">{response.duration} ms</span>
          <span className="text-xs text-gray-400">{formatSize(response.size)}</span>
        </div>
        {resolvedUrl && (
          <div className="px-4 pb-1.5">
            <p className="text-xs text-gray-500 font-mono truncate" title={resolvedUrl}>
              <span className="text-gray-600 mr-1">→</span>{resolvedUrl}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 px-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-xs px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            {t.label}
            {t.badge != null && (
              <span className="ml-1 bg-gray-600 text-gray-300 rounded-full px-1.5 text-xs">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'body' && (
          <Editor
            height="100%"
            language={lang}
            value={body}
            theme="vs-dark"
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, lineNumbers: 'off', scrollBeyondLastLine: false, wordWrap: 'on' }}
          />
        )}

        {tab === 'headers' && (
          <div className="p-4 overflow-auto h-full">
            <HeaderTable entries={Object.entries(response.headers)} />
          </div>
        )}

        {tab === 'request' && (
          <div className="p-4 overflow-auto h-full flex flex-col gap-4">
            {resolvedUrl && (
              <div>
                <p className="text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wide">Endpoint</p>
                <p className="text-sm text-gray-200 font-mono break-all">{resolvedUrl}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">
                Sent Headers <span className="text-gray-600 normal-case font-normal">(env vars 치환 후)</span>
              </p>
              <HeaderTable
                entries={sentHeaderEntries}
                emptyMessage="전송된 헤더 없음"
              />
            </div>
          </div>
        )}

        {tab === 'curl' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 shrink-0">
              <span className="text-xs text-gray-400 font-mono">curl command</span>
              <button
                onClick={() => curlCommand && navigator.clipboard.writeText(curlCommand)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                language="shell"
                value={curlCommand ?? ''}
                theme="vs-dark"
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, lineNumbers: 'off', scrollBeyondLastLine: false, wordWrap: 'on' }}
              />
            </div>
          </div>
        )}

        {tab === 'tests' && (
          <div className="p-4 overflow-auto h-full">
            {testResults.length === 0 ? (
              <p className="text-gray-500 text-sm">No tests ran. Add a test script in the Scripts tab.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="text-xs text-gray-400 mb-2">{passedCount}/{testResults.length} tests passed</div>
                {testResults.map((t, i) => (
                  <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded ${t.passed ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
                    <span className={t.passed ? 'text-green-400' : 'text-red-400'}>{t.passed ? '✓' : '✗'}</span>
                    <div>
                      <div className={t.passed ? 'text-green-300' : 'text-red-300'}>{t.name}</div>
                      {t.error && <div className="text-red-400 text-xs mt-0.5 font-mono">{t.error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
