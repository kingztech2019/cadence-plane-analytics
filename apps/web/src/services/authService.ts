import { apiRequest } from './api';
import type { AuthResponse } from '@flow-analytics/shared';

export const authService = {
  async login(email: string, password: string): Promise<void> {
    const data = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.token);
  },

  async signup(name: string, email: string, password: string): Promise<void> {
    const data = await apiRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    localStorage.setItem('token', data.token);
  },

  logout(): void {
    localStorage.removeItem('token');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },
};
