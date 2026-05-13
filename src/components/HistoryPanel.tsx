import { useAppStore } from '../store';
import type { HttpMethod } from '../types';

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-blue-400',
  PUT: 'text-yellow-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-pink-400',
  OPTIONS: 'text-gray-400',
};

function statusColor(status: number) {
  if (status === 0) return 'text-gray-500';
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-orange-400';
  if (status >= 300) return 'text-yellow-400';
  return 'text-green-400';
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function HistoryPanel() {
  const { history, clearHistory, setShowHistory } = useAppStore();

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={() => setShowHistory(false)}
    >
      <div
        className="w-[480px] bg-gray-900 border-l border-gray-700 flex flex-col h-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-gray-100 font-semibold text-sm">Request History</h2>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-red-400"
              >
                Clear
              </button>
            )}
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-gray-500 text-sm text-center mt-12">No history yet</div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="px-4 py-2.5 border-b border-gray-800 hover:bg-gray-800 group"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-mono font-bold w-14 shrink-0 ${METHOD_COLORS[item.method]}`}>
                    {item.method}
                  </span>
                  <span className={`text-xs font-mono font-semibold ${statusColor(item.status)}`}>
                    {item.status || 'ERR'}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">{item.duration}ms</span>
                  <span className="text-xs text-gray-600">{formatTime(item.timestamp)}</span>
                </div>
                <div className="text-xs text-gray-300 font-mono truncate pl-16" title={item.url}>
                  {item.url}
                </div>
                {item.requestName && (
                  <div className="text-xs text-gray-500 pl-16 mt-0.5 truncate">{item.requestName}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
