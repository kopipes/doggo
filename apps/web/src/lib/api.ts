import { ApiResult } from '@petreg/shared'

const BASE = '/api'

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
  signal?: AbortSignal,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {}
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    // Network failure or abort
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return { ok: false, error: 'Network error — check your connection' }
  }

  // Handle non-JSON responses (e.g. 502 from proxy as HTML)
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return { ok: false, error: `Server error (HTTP ${res.status})` }
  }

  try {
    const json = await res.json()
    return json as ApiResult<T>
  } catch {
    return { ok: false, error: 'Invalid response from server' }
  }
}

export const api = {
  get: <T>(path: string, token?: string | null, signal?: AbortSignal) =>
    request<T>('GET', path, undefined, token, signal),
  post: <T>(path: string, body: unknown, token?: string | null) =>
    request<T>('POST', path, body, token),
  put: <T>(path: string, body: unknown, token?: string | null) =>
    request<T>('PUT', path, body, token),
  patch: <T>(path: string, body: unknown, token?: string | null) =>
    request<T>('PATCH', path, body, token),
  delete: <T>(path: string, token?: string | null) =>
    request<T>('DELETE', path, undefined, token),
  upload: <T>(path: string, form: FormData, token?: string | null) =>
    request<T>('POST', path, form, token),
}
