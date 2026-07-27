// In production the dashboard and the API are served from the same Vercel
// deployment, so an empty base means "same origin" and there is no CORS hop.
// Locally the API runs separately on port 4000.
const BASE =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '');

const TOKEN_KEY = 'wp_admin_token';
const USER_KEY = 'wp_admin_user';

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const storedUser = {
  get: () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },
  set: (u) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
};

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  const headers = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // The browser's own "Failed to fetch" gives no hint that the server simply
    // is not there, which reads like a rejected password. Say what happened.
    throw new Error(
      BASE
        ? `Cannot reach the API at ${BASE}. Start it with "npm run dev" in the server folder, or use the deployed dashboard.`
        : 'Cannot reach the API. Check your internet connection and try again.'
    );
  }

  if (res.status === 401) {
    token.clear();
    window.location.hash = '#/login';
    throw new Error('Your session expired. Please sign in again.');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) =>
    request('/api/auth/admin/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),

  regions: () => request('/api/regions'),

  pickers: (params) => request('/api/pickers', { params }),
  picker: (id) => request(`/api/pickers/${id}`),
  setStatus: (id, status, note) =>
    request(`/api/pickers/${id}/status`, { method: 'PATCH', body: { status, note } }),
  setRole: (id, role) => request(`/api/pickers/${id}/role`, { method: 'PATCH', body: { role } }),
  deletePicker: (id) => request(`/api/pickers/${id}`, { method: 'DELETE' }),

  announcements: () => request('/api/announcements'),
  announcement: (id) => request(`/api/announcements/${id}`),
  broadcast: (payload) => request('/api/announcements', { method: 'POST', body: payload }),
  deleteAnnouncement: (id) => request(`/api/announcements/${id}`, { method: 'DELETE' }),

  collections: (params) => request('/api/collections', { params }),

  overview: () => request('/api/reports/overview'),
  reportRegistrations: (params) => request('/api/reports/registrations', { params }),
  reportByRegion: () => request('/api/reports/by-region'),
  reportCommunication: () => request('/api/reports/communication'),
  reportCollections: () => request('/api/reports/collections'),
};

/** Turns an array of flat objects into a CSV download. */
export function exportCsv(filename, rows) {
  if (!rows?.length) return;
  const cols = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
