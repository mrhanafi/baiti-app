import { getToken } from '@/lib/auth/storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8123';

// Thrown for any non-2xx response. Callers decide how to react (logout on 401,
// show validation errors on 422, etc.).
export class ApiError extends Error {
  status: number;
  body: any;

  constructor(status: number, body: any, message?: string) {
    super(message ?? `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

// Plain fetch wrapper. Attaches Sanctum bearer token if we have one, sets JSON
// headers, throws ApiError on failure. Returns parsed JSON on success.
export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Try to parse JSON regardless of status — most Laravel error responses are JSON too.
  let body: any = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, body, body?.message);
  }

  return body;
}
