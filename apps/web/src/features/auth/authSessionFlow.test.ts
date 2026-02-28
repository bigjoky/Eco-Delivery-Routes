import { describe, expect, test } from 'vitest';
import { sessionStore } from '../../core/auth/sessionStore';
import { apiClient } from '../../services/apiClient';

describe('auth session flow (mock)', () => {
  test('login persists token and logout clears session', async () => {
    sessionStore.setToken(null);
    sessionStore.setRoles([]);

    const login = await apiClient.login({
      email: 'admin@eco.local',
      password: 'password123',
    });

    expect(login.token).toBeTruthy();
    expect(sessionStore.isAuthenticated()).toBe(true);
    expect(sessionStore.getRoles()).toContain('super_admin');

    await apiClient.logout();
    expect(sessionStore.isAuthenticated()).toBe(false);
    expect(sessionStore.getRoles()).toEqual([]);
  });
});
