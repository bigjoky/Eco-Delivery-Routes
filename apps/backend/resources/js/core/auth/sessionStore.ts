const STORAGE_KEY = 'eco_delivery_routes_token';
const ROLES_STORAGE_KEY = 'eco_delivery_routes_roles';
let token: string | null = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
let roles: string[] = [];
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem(ROLES_STORAGE_KEY) ?? '[]';
    const parsed = JSON.parse(raw) as unknown;
    roles = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    roles = [];
  }
}

export const sessionStore = {
  syncFromStorage() {
    if (typeof window === 'undefined') return;
    token = window.localStorage.getItem(STORAGE_KEY);
    try {
      const raw = window.localStorage.getItem(ROLES_STORAGE_KEY) ?? '[]';
      const parsed = JSON.parse(raw) as unknown;
      roles = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      roles = [];
    }
    listeners.forEach((listener) => listener());
  },
  setToken(value: string | null) {
    token = value;
    if (typeof window !== 'undefined') {
      if (value) {
        window.localStorage.setItem(STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    listeners.forEach((listener) => listener());
  },
  getToken() {
    return token;
  },
  setRoles(value: string[]) {
    roles = value;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(value));
    }
    listeners.forEach((listener) => listener());
  },
  getRoles() {
    return roles;
  },
  isAuthenticated() {
    return !!token;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
