import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'respira_theme_mode';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (next: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDomTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', mode === 'dark' ? '#0b131e' : '#0f766e');
  }
}

function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // Ignora
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, updateLocalPreferences } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const initial = readInitialTheme();
    applyDomTheme(initial);
    return initial;
  });

  useEffect(() => {
    applyDomTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignora
    }
  }, [theme]);

  // Sincroniza o tema salvo no perfil do usuário quando autenticado
  useEffect(() => {
    if (user?.preferences && typeof user.preferences.temaNoturno === 'boolean') {
      const savedHasLocal = Boolean(window.localStorage.getItem(THEME_STORAGE_KEY));
      if (!savedHasLocal) {
        const userTheme: ThemeMode = user.preferences.temaNoturno ? 'dark' : 'light';
        setThemeState(userTheme);
      }
    }
  }, [user?.preferences]);

  const setTheme = useCallback(
    (next: ThemeMode) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Ignora
      }

      const nextIsDark = next === 'dark';

      if (isAuthenticated && user?.preferences) {
        updateLocalPreferences({
          ...user.preferences,
          temaNoturno: nextIsDark,
        });
      }

      if (isAuthenticated && navigator.onLine) {
        void api.updateTheme(nextIsDark).catch(() => {
          // Mantém preferência local no localStorage mesmo se offline
        });
      }
    },
    [isAuthenticated, updateLocalPreferences, user?.preferences]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggleTheme,
      setTheme,
    }),
    [setTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider.');
  }
  return ctx;
}
