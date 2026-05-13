export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export type BodyType = 'none' | 'json' | 'form' | 'text' | 'xml';

export interface RequestBody {
  type: BodyType;
  content: string;
}

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValueItem[];
  params: KeyValueItem[];
  pathVariables: KeyValueItem[];
  body: RequestBody;
  preRequestScript: string;
  testScript: string;
}

export interface Collection {
  id: string;
  name: string;
  requests: ApiRequest[];
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValueItem[];
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  size: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  method: HttpMethod;
  url: string;
  requestName: string;
  status: number;
  duration: number;
}
