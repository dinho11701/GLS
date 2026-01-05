// /lib/api.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Base API sans trailing slash */
const RAW_API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://127.0.0.1:5055/api/v1';
export const API_BASE = String(RAW_API_BASE).replace(/\/+$/, '');

export type ApiOpts = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;                // string | object | FormData
  timeoutMs?: number;        // défaut 20s
  idempotencyKey?: string;   // pour POST idempotents
};

export type ApiErrorData = { error?: string; message?: string; details?: any };
export class ApiError extends Error {
  status: number;
  data?: ApiErrorData;
  constructor(status: number, data?: ApiErrorData, fallback = 'Erreur serveur') {
    super(normalizeErr(data, fallback));
    this.status = status;
    this.data = data;
  }
}

/* ------------------ internals ------------------ */
function normalizeErr(data?: ApiErrorData, fallback = 'Requête échouée') {
  if (!data) return fallback;
  if (data.error === 'ValidationError' && Array.isArray((data as any).details)) {
    const msgs = (data as any).details.map((d: any) => d?.msg).filter(Boolean);
    if (msgs.length) return msgs.join(' — ');
  }
  return data.message || data.error || fallback;
}

async function authHeaders() {
  const token = await AsyncStorage.getItem('idToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function joinUrl(path: string) {
  const p = String(path || '').replace(/^\/+/, '');
  return `${API_BASE}/${p}`;
}

async function parseResponse(resp: Response) {
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await resp.json().catch(() => ({}));
  }
  return await resp.text();
}

/** Rafraîchit le token si 401 + refreshToken dispo */
async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const r = await fetch(joinUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.idToken) return null;

    await AsyncStorage.setItem('idToken', String(data.idToken));
    return String(data.idToken);
  } catch {
    return null;
  }
}

/* ------------------ public API ------------------ */
export async function apiFetch<T = any>(path: string, opts: ApiOpts = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, timeoutMs = 20000, idempotencyKey } = opts;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);

  const auth = await authHeaders();
  const finalHeaders: Record<string, string> = { ...auth, ...headers };
  if (idempotencyKey) finalHeaders['X-Idempotency-Key'] = idempotencyKey;

  let finalBody: any = body;
  // JSONify si objet "simple"
  if (body && typeof body === 'object' && !(body instanceof FormData) && typeof body !== 'string') {
    finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
    finalBody = JSON.stringify(body);
  }

  const doFetch = async (overrideToken?: string) => {
    const hdrs = { ...finalHeaders };
    if (overrideToken) hdrs['Authorization'] = `Bearer ${overrideToken}`;
    const resp = await fetch(joinUrl(path), {
      method,
      headers: hdrs,
      body: finalBody,
      signal: ctrl.signal,
    });
    return resp;
  };

  try {
    let resp = await doFetch();

    // tentative de refresh sur 401
    if (resp.status === 401) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        resp = await doFetch(newToken);
      }
    }

    const data = await parseResponse(resp);
    if (!resp.ok) throw new ApiError(resp.status, data as any, 'Erreur de requête');

    return data as T;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Délai dépassé (timeout).');
    throw e;
  } finally {
    clearTimeout(to);
  }
}

/* ---- Petits helpers HTTP ---- */
export const get  = <T=any>(path: string, headers?: Record<string,string>) =>
  apiFetch<T>(path, { method: 'GET', headers });

export const post = <T=any>(path: string, body?: any, headers?: Record<string,string>) =>
  apiFetch<T>(path, { method: 'POST', body, headers });

export const put  = <T=any>(path: string, body?: any, headers?: Record<string,string>) =>
  apiFetch<T>(path, { method: 'PUT', body, headers });

export const patch= <T=any>(path: string, body?: any, headers?: Record<string,string>) =>
  apiFetch<T>(path, { method: 'PATCH', body, headers });

export const del  = <T=any>(path: string, headers?: Record<string,string>) =>
  apiFetch<T>(path, { method: 'DELETE', headers });

/* ---- Upload multipart (images, etc.) ---- */
export async function upload<T=any>(path: string, formData: FormData, extraHeaders?: Record<string, string>) {
  // ne pas fixer 'Content-Type' (boundary auto)
  return apiFetch<T>(path, { method: 'POST', body: formData, headers: extraHeaders });
}

/* ---- Idempotency helper ---- */
export function newIdempotencyKey(prefix = 'req'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
