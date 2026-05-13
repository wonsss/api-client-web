import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Collection,
  ApiRequest,
  Environment,
  ResponseData,
  TestResult,
  HistoryItem,
} from '../types';

// Extract {paramName} from URL (single braces, not double)
export function extractPathVariables(url: string): string[] {
  const matches = url.match(/(?<!\{)\{([^{}]+)\}(?!\})/g) ?? [];
  return matches.map((m) => m.slice(1, -1));
}

function syncPathVariables(request: ApiRequest): ApiRequest {
  const names = extractPathVariables(request.url);
  const existing = new Map(request.pathVariables.map((p) => [p.key, p]));
  const pathVariables = names.map(
    (name) => existing.get(name) ?? { id: uuidv4(), key: name, value: '', enabled: true }
  );
  return { ...request, pathVariables };
}

function defaultRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    id: uuidv4(),
    name: 'New Request',
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    pathVariables: [],
    body: { type: 'none', content: '' },
    preRequestScript: '',
    testScript: '',
    ...overrides,
  };
}

const MAX_HISTORY = 100;

interface AppState {
  collections: Collection[];
  activeCollectionId: string | null;
  activeRequestId: string | null;

  environments: Environment[];
  activeEnvironmentId: string | null;

  history: HistoryItem[];

  response: ResponseData | null;
  resolvedUrl: string | null;
  sentHeaders: Record<string, string> | null;
  curlCommand: string | null;
  testResults: TestResult[];
  isLoading: boolean;

  showEnvManager: boolean;
  showHistory: boolean;

  // collection actions
  addCollection: (name: string) => void;
  removeCollection: (id: string) => void;
  renameCollection: (id: string, name: string) => void;
  importCollection: (collection: Collection) => void;

  // request actions
  setActive: (collectionId: string, requestId: string) => void;
  addRequest: (collectionId: string, partial?: Partial<ApiRequest>) => void;
  updateRequest: (collectionId: string, request: ApiRequest) => void;
  duplicateRequest: (collectionId: string, requestId: string) => void;
  removeRequest: (collectionId: string, requestId: string) => void;

  // environment actions
  setActiveEnvironment: (id: string | null) => void;
  addEnvironment: (name: string) => void;
  removeEnvironment: (id: string) => void;
  updateEnvironment: (env: Environment) => void;

  // history actions
  pushHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;

  // response actions
  setResponse: (response: ResponseData | null) => void;
  setResolvedUrl: (url: string | null) => void;
  setSentHeaders: (headers: Record<string, string> | null) => void;
  setCurlCommand: (cmd: string | null) => void;
  setTestResults: (results: TestResult[]) => void;
  setLoading: (loading: boolean) => void;

  // ui actions
  setShowEnvManager: (show: boolean) => void;
  setShowHistory: (show: boolean) => void;
  useLocalProxy: boolean;
  setUseLocalProxy: (use: boolean) => void;

  // selectors
  getActiveRequest: () => ApiRequest | null;
  getActiveEnvVars: () => Record<string, string>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      collections: [],
      activeCollectionId: null,
      activeRequestId: null,
      environments: [],
      activeEnvironmentId: null,
      history: [],
      response: null,
      resolvedUrl: null,
      sentHeaders: null,
      curlCommand: null,
      testResults: [],
      isLoading: false,
      showEnvManager: false,
      showHistory: false,
      useLocalProxy: false,

      addCollection: (name) =>
        set((s) => ({
          collections: [...s.collections, { id: uuidv4(), name, requests: [] }],
        })),

      removeCollection: (id) =>
        set((s) => ({
          collections: s.collections.filter((c) => c.id !== id),
          activeCollectionId: s.activeCollectionId === id ? null : s.activeCollectionId,
          activeRequestId: s.activeCollectionId === id ? null : s.activeRequestId,
        })),

      renameCollection: (id, name) =>
        set((s) => ({
          collections: s.collections.map((c) => (c.id === id ? { ...c, name } : c)),
        })),

      importCollection: (collection) =>
        set((s) => ({
          collections: [
            ...s.collections,
            { ...collection, requests: collection.requests.map(syncPathVariables) },
          ],
        })),

      setActive: (collectionId, requestId) =>
        set((s) => {
          const req = s.collections.find((c) => c.id === collectionId)?.requests.find((r) => r.id === requestId);
          return {
            activeCollectionId: collectionId,
            activeRequestId: requestId,
            response: null,
            testResults: [],
            ...(req && {
              collections: s.collections.map((c) =>
                c.id === collectionId
                  ? { ...c, requests: c.requests.map((r) => (r.id === requestId ? syncPathVariables(r) : r)) }
                  : c
              ),
            }),
          };
        }),

      addRequest: (collectionId, partial = {}) => {
        const req = defaultRequest(partial);
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId ? { ...c, requests: [...c.requests, req] } : c
          ),
          activeCollectionId: collectionId,
          activeRequestId: req.id,
          response: null,
          testResults: [],
        }));
      },

      updateRequest: (collectionId, request) => {
        const synced = syncPathVariables(request);
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId
              ? { ...c, requests: c.requests.map((r) => (r.id === synced.id ? synced : r)) }
              : c
          ),
        }));
      },

      duplicateRequest: (collectionId, requestId) => {
        const col = get().collections.find((c) => c.id === collectionId);
        const req = col?.requests.find((r) => r.id === requestId);
        if (!req) return;
        const copy = { ...req, id: uuidv4(), name: `${req.name} (copy)` };
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId ? { ...c, requests: [...c.requests, copy] } : c
          ),
          activeCollectionId: collectionId,
          activeRequestId: copy.id,
        }));
      },

      removeRequest: (collectionId, requestId) =>
        set((s) => ({
          collections: s.collections.map((c) =>
            c.id === collectionId
              ? { ...c, requests: c.requests.filter((r) => r.id !== requestId) }
              : c
          ),
          activeRequestId: s.activeRequestId === requestId ? null : s.activeRequestId,
        })),

      setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

      addEnvironment: (name) =>
        set((s) => ({
          environments: [...s.environments, { id: uuidv4(), name, variables: [] }],
        })),

      removeEnvironment: (id) =>
        set((s) => ({
          environments: s.environments.filter((e) => e.id !== id),
          activeEnvironmentId: s.activeEnvironmentId === id ? null : s.activeEnvironmentId,
        })),

      updateEnvironment: (env) =>
        set((s) => ({
          environments: s.environments.map((e) => (e.id === env.id ? env : e)),
        })),

      pushHistory: (item) =>
        set((s) => ({
          history: [{ ...item, id: uuidv4(), timestamp: Date.now() }, ...s.history].slice(0, MAX_HISTORY),
        })),

      clearHistory: () => set({ history: [] }),

      setResponse: (response) => set({ response }),
      setResolvedUrl: (resolvedUrl) => set({ resolvedUrl }),
      setSentHeaders: (sentHeaders) => set({ sentHeaders }),
      setCurlCommand: (curlCommand) => set({ curlCommand }),
      setTestResults: (testResults) => set({ testResults }),
      setLoading: (isLoading) => set({ isLoading }),
      setShowEnvManager: (showEnvManager) => set({ showEnvManager }),
      setShowHistory: (showHistory) => set({ showHistory }),
      setUseLocalProxy: (useLocalProxy) => set({ useLocalProxy }),

      getActiveRequest: () => {
        const { collections, activeCollectionId, activeRequestId } = get();
        if (!activeCollectionId || !activeRequestId) return null;
        return (
          collections
            .find((c) => c.id === activeCollectionId)
            ?.requests.find((r) => r.id === activeRequestId) ?? null
        );
      },

      getActiveEnvVars: () => {
        const { environments, activeEnvironmentId } = get();
        const env = environments.find((e) => e.id === activeEnvironmentId);
        if (!env) return {};
        return Object.fromEntries(
          env.variables
            .filter((v) => v.enabled && v.key)
            .map((v) => [v.key.replace(/^\{\{|\}\}$/g, '').trim(), v.value])
        );
      },
    }),
    { name: 'api-client-store', version: 2 }
  )
);
