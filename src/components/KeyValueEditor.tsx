import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { KeyValueItem } from '../types';

interface Props {
  items: KeyValueItem[];
  onChange: (items: KeyValueItem[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({ items, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }: Props) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const newKeyRef = useRef<HTMLInputElement>(null);
  const newValueRef = useRef<HTMLInputElement>(null);

  const update = (id: string, field: keyof KeyValueItem, value: string | boolean) => {
    onChange(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  const commit = () => {
    if (!newKey.trim()) return;
    onChange([...items, { id: uuidv4(), key: newKey.trim(), value: newValue, enabled: true }]);
    setNewKey('');
    setNewValue('');
  };

  const onNewKeyBlur = (e: React.FocusEvent) => {
    // focus가 같은 행의 value 필드로 이동하는 경우 커밋하지 않음
    if (e.relatedTarget === newValueRef.current) return;
    commit();
  };

  const onNewValueBlur = (e: React.FocusEvent) => {
    // focus가 같은 행의 key 필드로 이동하는 경우 커밋하지 않음
    if (e.relatedTarget === newKeyRef.current) return;
    commit();
  };

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => update(item.id, 'enabled', e.target.checked)}
            className="accent-blue-500 shrink-0"
          />
          <input
            value={item.key}
            placeholder={keyPlaceholder}
            onChange={(e) => update(item.id, 'key', e.target.value)}
            className="flex-1 bg-gray-700 text-gray-100 text-sm px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-500"
          />
          <input
            value={item.value}
            placeholder={valuePlaceholder}
            onChange={(e) => update(item.id, 'value', e.target.value)}
            className="flex-1 bg-gray-700 text-gray-100 text-sm px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-500"
          />
          <button
            onClick={() => remove(item.id)}
            className="text-gray-500 hover:text-red-400 text-xs shrink-0 w-5"
          >
            ✕
          </button>
        </div>
      ))}

      {/* 새 항목 입력 행 — relatedTarget으로 같은 행 내 이동 감지 */}
      <div className="flex items-center gap-2">
        <div className="w-4 shrink-0" />
        <input
          ref={newKeyRef}
          value={newKey}
          placeholder={keyPlaceholder}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && newKey.trim()) { e.preventDefault(); newValueRef.current?.focus(); }
            if (e.key === 'Enter') commit();
          }}
          onBlur={onNewKeyBlur}
          className="flex-1 bg-gray-700 text-gray-100 text-sm px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-500"
        />
        <input
          ref={newValueRef}
          value={newValue}
          placeholder={valuePlaceholder}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          onBlur={onNewValueBlur}
          className="flex-1 bg-gray-700 text-gray-100 text-sm px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-500"
        />
        <div className="w-5 shrink-0" />
      </div>
    </div>
  );
}
