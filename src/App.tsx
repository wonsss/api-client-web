import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { RequestPanel } from './components/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel';
import { EnvManager } from './components/EnvManager';
import { HistoryPanel } from './components/HistoryPanel';
import { useAppStore } from './store';

export default function App() {
  const showEnvManager = useAppStore((s) => s.showEnvManager);
  const showHistory = useAppStore((s) => s.showHistory);
  const [splitPos, setSplitPos] = useState(50);
  const [dragging, setDragging] = useState(false);

  const onMouseDown = () => setDragging(true);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const panel = e.currentTarget as HTMLElement;
    const rect = panel.getBoundingClientRect();
    const pct = ((e.clientY - rect.top) / rect.height) * 100;
    setSplitPos(Math.max(20, Math.min(80, pct)));
  };
  const onMouseUp = () => setDragging(false);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden select-none">
      <Sidebar />

      {/* Main area */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Request panel */}
        <div style={{ height: `${splitPos}%` }} className="overflow-hidden flex flex-col border-b border-gray-700">
          <RequestPanel />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onMouseDown}
          className="h-1 bg-gray-700 hover:bg-blue-600 cursor-row-resize transition-colors shrink-0"
        />

        {/* Response panel */}
        <div style={{ height: `${100 - splitPos}%` }} className="overflow-hidden flex flex-col">
          <ResponsePanel />
        </div>
      </div>

      {showEnvManager && <EnvManager />}
      {showHistory && <HistoryPanel />}
    </div>
  );
}
