import {
  CloudCheck,
  CloudOff,
  LogOut,
  RefreshCw,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CrisisOverlay } from '../components/panic/CrisisOverlay';
import { useAuth } from '../contexts/AuthContext';
import { usePanicMode } from '../hooks/usePanicMode';
import { API_BASE_URL } from '../services/api';

export function Home() {
  const { user, token, logout } = useAuth();

  const {
    isCrisisActive,
    isSyncingAudio,
    isOfflineReady,
    isOnline,
    cachedTracksCount,
    currentTrack,
    audioError,
    activatePanicMode,
    deactivatePanicMode,
    switchTrack,
    syncOfflineTracks,
  } = usePanicMode({
    apiBaseUrl: API_BASE_URL,
    authToken: token,
  });

  const firstName = user?.nome?.split(' ')[0] ?? 'você';

  return (
    <div className="flex min-h-screen flex-col justify-between bg-gradient-to-b from-calm-50 via-white to-calm-100/70 px-5 py-6">
      {/* Barra superior */}
      <header className="mx-auto flex w-full max-w-lg items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-calm-700">
            Respira PWA
          </p>
          <h1 className="text-lg font-bold text-slate-800">
            Olá, {firstName}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/preferences"
            title="Configurar músicas e contato de emergência"
            className="inline-flex items-center gap-1.5 rounded-xl border border-calm-200 bg-white px-3 py-2 text-xs font-semibold text-calm-800 shadow-sm transition hover:bg-calm-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Preferências
          </Link>

          <button
            type="button"
            onClick={logout}
            title="Sair da conta"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Botão de Pânico Central */}
      <main className="mx-auto my-8 flex w-full max-w-lg flex-col items-center text-center">
        <p className="mb-8 max-w-xs text-sm leading-relaxed text-slate-600">
          Sentindo a ansiedade subir? Toque no botão abaixo para ativar música acolhedora,
          vibração calma e respiração guiada imediatamente.
        </p>

        <div className="relative flex items-center justify-center">
          <span className="pointer-events-none absolute h-64 w-64 animate-breathe-soft rounded-full bg-calm-300/35" />
          <span className="pointer-events-none absolute h-56 w-56 rounded-full bg-calm-400/25" />

          <button
            type="button"
            onClick={() => void activatePanicMode()}
            className="relative z-10 flex h-48 w-48 flex-col items-center justify-center rounded-full bg-gradient-to-br from-calm-500 to-calm-700 text-white shadow-2xl shadow-calm-700/35 transition active:scale-95 hover:from-calm-600 hover:to-calm-800 focus:outline-none focus:ring-4 focus:ring-calm-300"
          >
            <Volume2 className="mb-2 h-10 w-10" />
            <span className="text-xl font-bold tracking-wide">PRECISO DE</span>
            <span className="text-2xl font-extrabold tracking-wider">CALMA</span>
          </button>
        </div>

        {/* Status do Cache Offline */}
        <div className="mt-10 flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-calm-200 bg-white/90 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
            {isOnline ? (
              <CloudCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <CloudOff className="h-4 w-4 text-amber-600" />
            )}
            <span>
              {isSyncingAudio
                ? 'Atualizando músicas no cache offline...'
                : isOfflineReady
                  ? `${cachedTracksCount} músicas salvas para uso offline`
                  : 'Áudio local de emergência pronto'}
            </span>
          </div>

          {isOnline && (
            <button
              type="button"
              disabled={isSyncingAudio}
              onClick={() => void syncOfflineTracks()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-calm-700 hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAudio ? 'animate-spin' : ''}`} />
              Renovar playlist offline
            </button>
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-lg text-center text-xs text-slate-500">
        Em caso de emergência emocional, você também pode ligar gratuitamente para o{' '}
        <a href="tel:188" className="font-semibold text-calm-700 underline">
          CVV (188)
        </a>{' '}
        a qualquer hora.
      </footer>

      {isCrisisActive && (
        <CrisisOverlay
          currentTrack={currentTrack}
          audioError={audioError}
          emergencyContactName={user?.preferences?.contatoEmergenciaNome}
          emergencyContactPhone={user?.preferences?.contatoEmergenciaTelefone}
          onSwitchTrack={switchTrack}
          onStop={deactivatePanicMode}
        />
      )}
    </div>
  );
}
