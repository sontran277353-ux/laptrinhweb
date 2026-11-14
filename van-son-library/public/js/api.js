const TOKEN_KEY = 'van-son-library-token';
const DEFAULT_API_BASE = 'http://localhost:3000';

function resolveApiBase() {
  const origin = window.location.origin;
  return origin && origin !== 'null' ? origin : DEFAULT_API_BASE;
}

function apiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, `${resolveApiBase()}/`).toString();
}

export const api = {
  async request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(apiUrl(path), { ...options, headers });
    if (response.status === 204) {
      return null;
    }

    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 401 && token) {
        localStorage.removeItem(TOKEN_KEY);
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      throw new Error(payload.error || 'Không thể hoàn tất yêu cầu.');
    }
    return payload;
  },

  get(path) {
    return this.request(path);
  },

  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  },

  put(path, body) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body) });
  },

  patch(path, body) {
    return this.request(path, { method: 'PATCH', body: JSON.stringify(body) });
  },

  delete(path) {
    return this.request(path, { method: 'DELETE' });
  }
};
