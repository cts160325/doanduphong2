export class ApiError extends Error {
  constructor(code, status, meta = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.meta = meta || {};
  }
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function api(path, options = {}) {
  const { method = 'GET', body } = options;
  const response = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const meta = { ...(payload || {}) };
    const code = meta.error || 'generic';
    delete meta.error;
    throw new ApiError(code, response.status, meta);
  }
  return payload;
}

export const apiGet = (path, params) => api(`${path}${buildQuery(params)}`);
export const apiPost = (path, body) => api(path, { method: 'POST', body });
export const apiPatch = (path, body) => api(path, { method: 'PATCH', body });
export const apiDelete = (path) => api(path, { method: 'DELETE' });
