import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../store';
import { KeyValueEditor } from './KeyValueEditor';
import { extractCollectionVars } from '../lib/utils';

export function EnvManager() {
  const { environments, collections, addEnvironment, removeEnvironment, updateEnvironment, setShowEnvManager } = useAppStore();
  const detectedVars = extractCollectionVars(collections);
  const [selectedId, setSelectedId] = useState<string | null>(environments[0]?.id ?? null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const selected = environments.find((e) => e.id === selectedId);

  const submitNew = () => {
    const name = newName.trim();
    if (name) addEnvironment(name);
    setNewName('');
    setAdding(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setShowEnvManager(false)}
    >
      <div
        className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl w-[700px] h-[500px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <h2 className="text-gray-100 font-semibold">Environments</h2>
          <button onClick={() => setShowEnvManager(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Env list */}
          <div className="w-48 border-r border-gray-700 flex flex-col">
            <div className="flex-1 overflow-y-auto py-1">
              {environments.map((env) => (
                <div
                  key={env.id}
                  className={`flex items-center px-3 py-2 cursor-pointer hover:bg-gray-700 group ${selectedId === env.id ? 'bg-gray-700' : ''}`}
                  onClick={() => setSelectedId(env.id)}
                >
                  <span className="flex-1 text-sm text-gray-200 truncate">{env.name}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEnvironment(env.id);
                      if (selectedId === env.id) setSelectedId(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-gray-700">
              {adding ? (
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitNew();
                    if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                  }}
                  onBlur={submitNew}
                  placeholder="Env name"
                  className="w-full bg-gray-700 text-gray-100 text-xs px-2 py-1 rounded border border-blue-500 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="w-full text-center text-xs text-gray-400 hover:text-white py-1"
                >
                  + Add environment
                </button>
              )}
            </div>
          </div>

          {/* Variables editor */}
          <div className="flex-1 overflow-auto p-4">
            {selected ? (
              <div className="flex flex-col gap-3">
                <div className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-200">{selected.name}</span> 환경변수 —
                  키는 <code className="text-yellow-400">BASE_URL</code> 형식으로 입력,
                  URL/헤더에서 <code className="text-blue-400">{`{{BASE_URL}}`}</code> 로 참조
                </div>
                <KeyValueEditor
                  items={selected.variables}
                  onChange={(variables) => updateEnvironment({ ...selected, variables })}
                  keyPlaceholder="VARIABLE_NAME"
                  valuePlaceholder="value"
                />
                {(() => {
                  const existingKeys = new Set(selected.variables.map((v) => v.key));
                  const missing = detectedVars.filter((v) => !existingKeys.has(v));
                  if (missing.length === 0) return null;
                  return (
                    <div className="border-t border-gray-700 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-400">컬렉션에서 감지된 변수</span>
                        <button
                          className="text-xs text-blue-400 hover:text-blue-300"
                          onClick={() => {
                            const newVars = missing.map((key) => ({ id: uuidv4(), key, value: '', enabled: true }));
                            updateEnvironment({ ...selected, variables: [...selected.variables, ...newVars] });
                          }}
                        >
                          전체 추가
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map((varName) => (
                          <button
                            key={varName}
                            className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-yellow-400 text-xs px-2 py-0.5 rounded"
                            onClick={() => {
                              const newVar = { id: uuidv4(), key: varName, value: '', enabled: true };
                              updateEnvironment({ ...selected, variables: [...selected.variables, newVar] });
                            }}
                          >
                            <span>{`{{${varName}}}`}</span>
                            <span className="text-gray-400">+</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-gray-500 text-sm mt-4">Select or create an environment</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
