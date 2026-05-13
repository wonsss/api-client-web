import { useRef, useState } from 'react';
import { useAppStore } from '../store';
import { parseSwaggerSpec } from '../lib/swagger';
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

export function Sidebar() {
  const {
    history,
    setShowHistory,
    collections,
    activeCollectionId,
    activeRequestId,
    addCollection,
    removeCollection,
    renameCollection,
    importCollection,
    addRequest,
    removeRequest,
    duplicateRequest,
    setActive,
    setShowEnvManager,
    environments,
    activeEnvironmentId,
    setActiveEnvironment,
  } = useAppStore();

  const [newCollectionName, setNewCollectionName] = useState('');
  const [addingCollection, setAddingCollection] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; type: 'collection' | 'request'; collectionId: string; requestId?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleImportSwagger = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      try {
        const collection = parseSwaggerSpec(text);
        importCollection(collection);
        setExpandedIds((prev) => new Set([...prev, collection.id]));
      } catch {
        alert('Invalid OpenAPI/Swagger spec');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const submitNewCollection = () => {
    const name = newCollectionName.trim();
    if (name) {
      addCollection(name);
    }
    setNewCollectionName('');
    setAddingCollection(false);
  };

  return (
    <aside
      className="w-64 shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col h-full select-none"
      onClick={() => setContextMenu(null)}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-1">
        <span className="text-gray-300 text-sm font-semibold flex-1">Collections</span>
        <button
          title="New collection"
          onClick={() => setAddingCollection(true)}
          className="text-gray-400 hover:text-white text-lg leading-none px-1"
        >
          +
        </button>
        <button
          title="Import Swagger/OpenAPI"
          onClick={handleImportSwagger}
          className="text-gray-400 hover:text-blue-400 text-xs px-1"
        >
          ↑ Swagger
        </button>
        <button
          title="Request history"
          onClick={() => setShowHistory(true)}
          className="relative text-gray-400 hover:text-white text-xs px-1"
        >
          ⏱
          {history.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
              {history.length > 99 ? '99' : history.length}
            </span>
          )}
        </button>
      </div>

      {/* Collections list */}
      <div className="flex-1 overflow-y-auto py-1">
        {addingCollection && (
          <div className="px-3 py-1">
            <input
              autoFocus
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewCollection();
                if (e.key === 'Escape') { setAddingCollection(false); setNewCollectionName(''); }
              }}
              onBlur={submitNewCollection}
              placeholder="Collection name"
              className="w-full bg-gray-700 text-gray-100 text-sm px-2 py-1 rounded border border-blue-500 focus:outline-none"
            />
          </div>
        )}

        {collections.map((col) => (
          <div key={col.id}>
            {/* Collection row */}
            {renamingId === col.id ? (
              <div className="px-3 py-1">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { renameCollection(col.id, renameValue); setRenamingId(null); }
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => { renameCollection(col.id, renameValue); setRenamingId(null); }}
                  className="w-full bg-gray-700 text-gray-100 text-sm px-2 py-1 rounded border border-blue-500 focus:outline-none"
                />
              </div>
            ) : (
              <div
                className={`flex items-center px-3 py-1.5 cursor-pointer hover:bg-gray-700 group ${activeCollectionId === col.id && !activeRequestId ? 'bg-gray-700' : ''}`}
                onClick={() => toggleExpand(col.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'collection', collectionId: col.id });
                }}
              >
                <span className="text-gray-400 mr-1 text-xs">{expandedIds.has(col.id) ? '▾' : '▸'}</span>
                <span className="text-gray-200 text-sm truncate flex-1">{col.name}</span>
                <span className="text-gray-500 text-xs ml-1 opacity-0 group-hover:opacity-100">{col.requests.length}</span>
              </div>
            )}

            {/* Requests */}
            {expandedIds.has(col.id) && (
              <div>
                {col.requests.map((req) => (
                  <div
                    key={req.id}
                    className={`flex items-center pl-7 pr-3 py-1 cursor-pointer hover:bg-gray-700 group ${activeRequestId === req.id ? 'bg-gray-700 border-l-2 border-blue-500' : ''}`}
                    onClick={() => setActive(col.id, req.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, type: 'request', collectionId: col.id, requestId: req.id });
                    }}
                  >
                    <span className={`text-xs font-mono w-14 shrink-0 ${METHOD_COLORS[req.method]}`}>
                      {req.method}
                    </span>
                    <span className="text-gray-300 text-xs truncate">{req.name}</span>
                  </div>
                ))}
                <button
                  onClick={() => addRequest(col.id)}
                  className="w-full text-left pl-7 pr-3 py-1 text-gray-500 hover:text-gray-300 text-xs hover:bg-gray-700"
                >
                  + Add request
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Environment selector */}
      <div className="border-t border-gray-700 px-3 py-2 flex items-center gap-2">
        <select
          value={activeEnvironmentId ?? ''}
          onChange={(e) => setActiveEnvironment(e.target.value || null)}
          className="flex-1 bg-gray-700 text-gray-200 text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          <option value="">No environment</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>{env.name}</option>
          ))}
        </select>
        <button
          onClick={() => setShowEnvManager(true)}
          className="text-gray-400 hover:text-white text-xs"
          title="Manage environments"
        >
          ⚙
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-xl py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'collection' && (
            <>
              <button
                className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                onClick={() => {
                  addRequest(contextMenu.collectionId);
                  setExpandedIds((p) => new Set([...p, contextMenu.collectionId]));
                  setContextMenu(null);
                }}
              >
                Add request
              </button>
              <button
                className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                onClick={() => {
                  const col = collections.find((c) => c.id === contextMenu.collectionId);
                  setRenameValue(col?.name ?? '');
                  setRenamingId(contextMenu.collectionId);
                  setContextMenu(null);
                }}
              >
                Rename
              </button>
              <hr className="border-gray-700 my-1" />
              <button
                className="w-full text-left px-4 py-1.5 text-sm text-red-400 hover:bg-gray-700"
                onClick={() => { removeCollection(contextMenu.collectionId); setContextMenu(null); }}
              >
                Delete
              </button>
            </>
          )}
          {contextMenu.type === 'request' && contextMenu.requestId && (
            <>
              <button
                className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                onClick={() => { duplicateRequest(contextMenu.collectionId, contextMenu.requestId!); setContextMenu(null); }}
              >
                Duplicate
              </button>
              <hr className="border-gray-700 my-1" />
              <button
                className="w-full text-left px-4 py-1.5 text-sm text-red-400 hover:bg-gray-700"
                onClick={() => { removeRequest(contextMenu.collectionId, contextMenu.requestId!); setContextMenu(null); }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
