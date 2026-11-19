import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AUTH_TOKEN_STORAGE_KEY, ApiError, api } from '../services/api';
import type { AuthUser, UserPreferences } from '../types';

const AUTH_USER_SNAPSHOT_KEY = 'respira_auth_user_snapshot';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPreferences: boolean;
  login: (payload: {
    email: string;
    senha: string;
    captchaToken: string;
  }) => Promise<AuthUser>;
  register: (payload: {
    nome: string;
    email: string;
    senha: string;
    dataNascimento: string;
    captchaToken: string;
  }) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateLocalPreferences: (preferences: UserPreferences) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_USER_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: AuthUser | null): void {
  try {
    if (user) {
      window.localStorage.setItem(AUTH_USER_SNAPSHOT_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_USER_SNAPSHOT_KEY);
    }
  } catch {
    // Ignora falhas de quota
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const hasToken = Boolean(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
    const hasSnapshot = Boolean(readStoredUser());
    return hasToken && !hasSnapshot;
  });

  const persistSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken);
    writeStoredUser(nextUser);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    writeStoredUser(null);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    if (!storedToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    // Libera a tela imediatamente com o snapshot local para não bloquear em Cold Start do backend
    const initialSnapshot = readStoredUser();
    if (initialSnapshot) {
      setUser(initialSnapshot);
      setIsLoading(false);
    }

    // Modo Offline-First: se o celular abrir o app sem internet, preserva a sessão
    // localmente para que o Botão de Pânico funcione sem pedir login.
    if (!navigator.onLine) {
      if (initialSnapshot) {
        setToken(storedToken);
      }
      setIsLoading(false);
      return;
    }

    try {
      const { user: verifiedUser } = await api.me(storedToken);
      setToken(storedToken);
      setUser(verifiedUser);
      writeStoredUser(verifiedUser);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        logout();
      } else {
        // Falha temporária de rede: mantém snapshot offline se existir
        const snapshot = readStoredUser();
        if (snapshot) {
          setUser(snapshot);
        } else {
          logout();
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  // Verifica automaticamente a sessão persistente ao abrir o PWA
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (payload: { email: string; senha: string; captchaToken: string }) => {
      const response = await api.login(payload);
      persistSession(response.token, response.user);
      return response.user;
    },
    [persistSession]
  );

  const register = useCallback(
    async (payload: {
      nome: string;
      email: string;
      senha: string;
      dataNascimento: string;
      captchaToken: string;
    }) => {
      const response = await api.register(payload);
      persistSession(response.token, response.user);
      return response.user;
    },
    [persistSession]
  );

  const updateLocalPreferences = useCallback((preferences: UserPreferences) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated: AuthUser = {
        ...prev,
        hasPreferences:
          Boolean(preferences.modoAleatorio) ||
          preferences.generosMusicais.length > 0 ||
          preferences.artistasPreferidos.length > 0,
        preferences,
      };
      writeStoredUser(updated);
      return updated;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token && user),
      hasPreferences: Boolean(user?.hasPreferences),
      login,
      register,
      logout,
      refreshUser,
      updateLocalPreferences,
    }),
    [user, token, isLoading, login, register, logout, refreshUser, updateLocalPreferences]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider.');
  }
  return ctx;
}
