import { create } from 'zustand';
import * as api from '../utils/api';
import { isTauri } from '../utils/tauriBridge';
import type { User } from '../types';
import bcrypt from 'bcryptjs';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  serverMode: boolean; // true if connected to Express, false if running on local simulation
  loading: boolean;
  error: string | null;
  registrationRequiredUserId: string | null;

  login: (username: string, password: string) => Promise<{ success: boolean; status?: 'device_registration_required' | 'success'; userId?: string; error?: string }>;
  registerCurrentDevice: (userId: string) => Promise<boolean>;
  changePassword: (newPassword: string) => Promise<boolean>;
  updateUserProfile: (updates: {
    name: string;
    email?: string | null;
    phone?: string | null;
    profile_image?: string | null;
    password?: string | null;
  }) => Promise<boolean>;
  logout: () => void;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoggedIn: false,
  serverMode: true,
  loading: true,
  error: null,
  registrationRequiredUserId: null,

  login: async (username, password) => {
    set({ loading: true, error: null, registrationRequiredUserId: null });
    try {
      const deviceHash = await api.getDeviceHash();

      // 1. Try Express Login API
      let loginData;
      try {
        let lastError: Error | null = null;
        for (const baseUrl of api.getServerUrlCandidates()) {
          try {
            const response = await fetch(`${baseUrl}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password, deviceHash })
            });

            if (response.status === 404 || response.status === 405) {
              throw new Error('SERVER_CANDIDATE_INVALID');
            }

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              const candidateError = new Error(errData.message || `HTTP error! status: ${response.status}`);
              if (response.status === 401 || response.status === 403) {
                lastError = candidateError;
                continue;
              }
              throw candidateError;
            }

            loginData = await response.json();
            localStorage.setItem('pa_server_url', baseUrl);
            break;
          } catch (err: any) {
            lastError = err;
            if (!(err.message?.includes('Failed to fetch') || err.message?.includes('Load failed') || err.message === 'SERVER_OFFLINE' || err.message === 'SERVER_CANDIDATE_INVALID')) {
              throw err;
            }
          }
        }

        if (!loginData) {
          throw lastError || new Error('SERVER_OFFLINE');
        }
      } catch (err: any) {
        if (err.message.includes('Failed to fetch') || err.message.includes('Load failed') || err.message === 'SERVER_OFFLINE') {
          // Fallback to local mode (Tauri SQLite or LocalStorage)
          if (isTauri()) {
            // A. Tauri SQLite Mode
            // @ts-ignore
            const { invoke } = await import('@tauri-apps/api');
            const hash = await invoke('db_get_user_password_hash', { username }) as string | null;
            if (!hash) {
              throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
            }
            
            const isMatch = bcrypt.compareSync(password, hash);
            if (!isMatch) {
              throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
            }

            const users: User[] = await invoke('db_get_users');
            const matched = users.find(u => u.username === username || u.email === username);
            if (!matched) {
              throw new Error('아이디 또는 비밀번호가 일치하지 않습니다.');
            }
            if (matched.status === 'inactive') {
              throw new Error('비활성화된 계정입니다. 관리자에게 문의하세요.');
            }

            if (!matched.device_hash) {
              set({ registrationRequiredUserId: matched.id, loading: false });
              return { success: false, status: 'device_registration_required', userId: matched.id };
            }

            if (matched.device_hash !== deviceHash) {
              throw new Error('등록되지 않은 PC입니다. 관리자에게 문의하세요.');
            }

            // Success
            loginData = {
              token: `mock-jwt-token-for-${matched.id}`,
              user: matched
            };
          } else {
            // B. LocalStorage Fallback Mode
            const data = await api.localFallbackLogin(username, password, deviceHash);
            if (data.status === 'device_registration_required') {
              set({ registrationRequiredUserId: data.userId, loading: false });
              return { success: false, status: 'device_registration_required', userId: data.userId };
            }
            loginData = data;
          }
        } else {
          throw err;
        }
      }

      if (loginData.status === 'device_registration_required') {
        set({ registrationRequiredUserId: loginData.userId, loading: false });
        return { success: false, status: 'device_registration_required', userId: loginData.userId };
      }

      // Check if serverMode is true or false
      const isServer = !loginData.token || !loginData.token.startsWith('mock-jwt-token-for-');

      localStorage.setItem('pa_token', loginData.token);
      localStorage.setItem('pa_user', JSON.stringify(loginData.user));
      localStorage.setItem('pa_server_mode', String(isServer));

      set({
        token: loginData.token,
        user: loginData.user,
        isLoggedIn: true,
        serverMode: isServer,
        loading: false
      });
      return { success: true, status: 'success' };
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return { success: false, error: err.message };
    }
  },

  registerCurrentDevice: async (userId) => {
    set({ loading: true, error: null });
    try {
      const deviceHash = await api.getDeviceHash();
      // Detect mode
      const isServer = useAuthStore.getState().serverMode;
      await api.registerDevice(isServer, userId, deviceHash);
      set({ registrationRequiredUserId: null, loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  changePassword: async (newPassword) => {
    set({ loading: true, error: null });
    try {
      const isServer = useAuthStore.getState().serverMode;
      await api.changePassword(isServer, newPassword);
      
      // Update local storage user data
      const userJson = localStorage.getItem('pa_user');
      if (userJson) {
        const u = JSON.parse(userJson);
        u.force_password_change = 0;
        localStorage.setItem('pa_user', JSON.stringify(u));
        set({ user: u });
      }
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  updateUserProfile: async (updates) => {
    set({ loading: true, error: null });
    try {
      const isServer = useAuthStore.getState().serverMode;
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) throw new Error('로그인 정보가 없습니다.');
      const updatedUser = await api.updateUserProfile(isServer, currentUser.id, updates);
      localStorage.setItem('pa_user', JSON.stringify(updatedUser));
      set({ user: updatedUser, loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('pa_token');
    localStorage.removeItem('pa_user');
    localStorage.removeItem('pa_server_mode');
    set({
      user: null,
      token: null,
      isLoggedIn: false,
      error: null,
      registrationRequiredUserId: null
    });
  },

  checkSession: async () => {
    set({ loading: true });
    const token = localStorage.getItem('pa_token');
    const userJson = localStorage.getItem('pa_user');

    if (!token || !userJson) {
      set({ isLoggedIn: false, user: null, token: null, loading: false });
      return;
    }

    let cachedUser: User;
    try {
      cachedUser = JSON.parse(userJson);
    } catch {
      localStorage.removeItem('pa_token');
      localStorage.removeItem('pa_user');
      set({ isLoggedIn: false, user: null, token: null, loading: false });
      return;
    }

    const cachedServerMode = !token.startsWith('mock-jwt-token-for-');
    localStorage.setItem('pa_server_mode', String(cachedServerMode));
    set({
      user: cachedUser,
      token,
      isLoggedIn: true,
      serverMode: cachedServerMode,
      loading: false
    });

    try {
      // Try validating token with Express server
      const data = await api.apiRequest('/auth/me');
      set({
        user: data.user,
        token,
        isLoggedIn: true,
        serverMode: true,
        loading: false
      });
      localStorage.setItem('pa_server_mode', 'true');
    } catch (err: any) {
      if (err.message === 'SERVER_OFFLINE' || err.message.includes('Failed to fetch') || err.message.includes('Load failed')) {
        // Fallback to local stored session info if server offline
        localStorage.setItem('pa_server_mode', 'false');
        set({
          user: cachedUser,
          token,
          isLoggedIn: true,
          serverMode: false,
          loading: false
        });
      } else {
        console.warn('Session validation failed. Keeping cached session to avoid unexpected logout:', err);
        localStorage.setItem('pa_server_mode', 'false');
        set({
          user: cachedUser,
          token,
          isLoggedIn: true,
          serverMode: false,
          loading: false
        });
      }
    }
  },

  clearError: () => set({ error: null })
}));
