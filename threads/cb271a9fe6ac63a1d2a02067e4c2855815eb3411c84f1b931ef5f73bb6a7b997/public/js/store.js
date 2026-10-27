import { apiGet, apiPost } from './api.js';

export const store = {
  user: null,
  categories: [],
  stats: null,
  settings: {
    LOAN_DAYS: 14,
    MAX_ACTIVE_LOANS: 5,
    MAX_RENEWALS: 2,
    RENEW_DAYS: 7,
    FINE_PER_DAY: 5000,
    HOLD_HOURS: 48,
  },
  isAdmin: false,
};

const listeners = new Set();

export function onStoreChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener(store);
}

export async function loadSession() {
  const data = await apiGet('/api/auth/me');
  setUser(data.user);
  return store.user;
}

export function setUser(user) {
  store.user = user || null;
  store.isAdmin = Boolean(user && user.role === 'admin');
  emit();
}

export async function loadCategories() {
  const data = await apiGet('/api/categories');
  store.categories = data.items || [];
  emit();
  return store.categories;
}

export async function loadStats() {
  const data = await apiGet('/api/stats');
  store.stats = data.stats;
  store.settings = { ...store.settings, ...data.settings };
  emit();
  return store.stats;
}

export async function logout() {
  await apiPost('/api/auth/logout', {});
  setUser(null);
}
