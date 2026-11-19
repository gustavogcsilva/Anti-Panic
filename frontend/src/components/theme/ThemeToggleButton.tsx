import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeToggleButtonProps {
  variant?: 'default' | 'headerDark';
  showLabel?: boolean;
}

export function ThemeToggleButton({
  variant = 'default',
  showLabel = true,
}: ThemeToggleButtonProps) {
  const { isDark, toggleTheme } = useTheme();

  if (variant === 'headerDark') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={isDark ? 'Alternar para Modo Dia (Claro)' : 'Alternar para Modo Noturno (Escuro)'}
        aria-label={isDark ? 'Ativar Modo Dia' : 'Ativar Modo Noturno'}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
      >
        {isDark ? (
          <>
            <Sun className="h-4 w-4 text-amber-300" />
            {showLabel && <span className="hidden sm:inline">Modo Dia</span>}
          </>
        ) : (
          <>
            <Moon className="h-4 w-4 text-calm-100" />
            {showLabel && <span className="hidden sm:inline">Modo Noite</span>}
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Alternar para Modo Dia (Claro)' : 'Alternar para Modo Noturno (Escuro)'}
      aria-label={isDark ? 'Ativar Modo Dia' : 'Ativar Modo Noturno'}
      className="inline-flex items-center gap-1.5 rounded-xl border border-calm-200 bg-white px-3 py-2 text-xs font-semibold text-calm-800 shadow-sm transition hover:bg-calm-50"
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-amber-400" />
          {showLabel && <span className="hidden sm:inline">Dia</span>}
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-calm-700" />
          {showLabel && <span className="hidden sm:inline">Noite</span>}
        </>
      )}
    </button>
  );
}
