/**
 * Lightweight fetch wrapper that:
 * - Sends/receives the auth cookie (`credentials: 'include'`).
 * - Parses JSON response bodies.
 * - Throws ApiError with a `.code` field for non-2xx responses so the UI
 *   can show a meaningful message.
 */

export class ApiError extends Error {
  constructor(message, { status, code, body }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, headers, signal } = {}) {
  const init = {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    signal
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    throw new ApiError('Network error', { status: 0, code: 'network_error', body: null });
  }

  let payload = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
  }

  if (!response.ok) {
    const code = (payload && payload.error) || `http_${response.status}`;
    throw new ApiError(
      (payload && payload.message) || code,
      { status: response.status, code, body: payload }
    );
  }

  return payload;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' })
};

// Currency / date helpers shared across pages.
export function formatIDR(amount) {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function formatDate(value) {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium'
  });
}
