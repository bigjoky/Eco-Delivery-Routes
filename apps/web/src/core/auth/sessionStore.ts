const STORAGE_KEY = 'eco_delivery_routes_token';
const ROLES_STORAGE_KEY = 'eco_delivery_routes_roles';
let token: string | null = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
let roles: string[] = [];
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
  setToken(value: string | null) {
    token = value;
    if (typeof window !== 'undefined') {
      if (value) {
        window.localStorage.setItem(STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  },
  getToken() {
    return token;
  },
  setRoles(value: string[]) {
    roles = value;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(value));
    }
  },
  getRoles() {
    return roles;
  },
  isAuthenticated() {
    return !!token;
  },
};
