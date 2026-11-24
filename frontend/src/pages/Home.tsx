import {
  LogOut,
  MessageCircleHeart,
  RefreshCw,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RelaxingMusicPlayer } from '../components/music/RelaxingMusicPlayer';
import { CrisisOverlay } from '../components/panic/CrisisOverlay';
import { ThemeToggleButton } from '../components/theme/ThemeToggleButton';
import { useAuth } from '../contexts/AuthContext';
import { usePanicMode } from '../hooks/usePanicMode';
import { API_BASE_URL } from '../services/api';

export function Home() {
  const { user, token, logout } = useAuth();

  const {
    isCrisisActive,
    isSyncingAudio,
    isOnline,
    activatePanicMode,
    deactivatePanicMode,
    syncOfflineTracks,
  } = usePanicMode({
    apiBaseUrl: API_BASE_URL,
    authToken: token,
  });

  const firstName = user?.nome?.split(' ')[0] ?? 'você';
  const friendName = user?.preferences?.nomeAmigo?.trim() || 'Amigo';

  return (
    <div className="flex min-h-screen flex-col justify-between bg-gradient-to-b from-calm-50 via-white to-calm-100/70 px-4 py-5 sm:px-5 sm:py-6">
      {/* Barra superior */}
      <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-calm-700">
            Respira PWA
          </p>
          <h1 className="text-lg font-bold text-slate-800">
            Olá, {firstName}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggleButton />

          <Link
            to="/chat"
            title={`Conversar com ${friendName}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-calm-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-calm-700"
          >
            <MessageCircleHeart className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Falar com {friendName}</span>
          </Link>

          <Link
            to="/preferences"
            title="Configurar músicas, amigo e contato de emergência"
            className="inline-flex items-center gap-1.5 rounded-xl border border-calm-200 bg-white px-3 py-2 text-xs font-semibold text-calm-800 shadow-sm transition hover:bg-calm-50"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Preferências</span>
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

      {/* Botão de Pânico Central + Player Sempre Visível */}
      <main className="mx-auto my-6 flex w-full max-w-lg flex-col items-center text-center">
        <p className="mb-7 max-w-xs text-sm leading-relaxed text-slate-600">
          Sentindo a ansiedade subir? Toque no botão abaixo para ativar música acolhedora,
          vibração calma, respiração guiada e conversa imediata com{' '}
          <strong className="text-calm-800">{friendName}</strong>.
        </p>

        <div className="relative flex items-center justify-center">
          <span className="pointer-events-none absolute h-60 w-60 animate-breathe-soft rounded-full bg-calm-300/35" />
          <span className="pointer-events-none absolute h-52 w-52 rounded-full bg-calm-400/25" />

          <button
            type="button"
            onClick={() => void activatePanicMode()}
            className="relative z-10 flex h-44 w-44 flex-col items-center justify-center rounded-full bg-gradient-to-br from-calm-500 to-calm-700 text-white shadow-2xl shadow-calm-700/35 transition active:scale-95 hover:from-calm-600 hover:to-calm-800 focus:outline-none focus:ring-4 focus:ring-calm-300 sm:h-48 sm:w-48"
          >
            <Volume2 className="mb-2 h-9 w-9 sm:h-10 sm:w-10" />
            <span className="text-lg font-bold tracking-wide sm:text-xl">PRECISO DE</span>
            <span className="text-xl font-extrabold tracking-wider sm:text-2xl">CALMA</span>
          </button>
        </div>

        {/* Player de Música Relaxante (sempre visível no visor com busca, controles e cache offline) */}
        <div className="mt-9 w-full">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-calm-700">
              Música Relaxante &amp; Offline
            </h2>
            {isOnline && (
              <button
                type="button"
                disabled={isSyncingAudio}
                onClick={() => void syncOfflineTracks()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-calm-700 hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingAudio ? 'animate-spin' : ''}`} />
                Renovar playlist
              </button>
            )}
          </div>

          <RelaxingMusicPlayer variant="full" />
        </div>

        {/* Card de Acesso Rápido ao Companheiro de Conversa */}
        <div className="mt-4 w-full">
          <Link
            to="/chat"
            className="flex items-center justify-between gap-3 rounded-2xl border border-calm-200 bg-white/95 p-4 text-left shadow-sm transition hover:border-calm-400 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-calm-100 text-calm-700">
                <MessageCircleHeart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Conversar com {friendName}
                </p>
                <p className="text-xs text-slate-500">
                  Desabafe por texto ou áudio (estilo WhatsApp) e gere seu relatório em PDF
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-xl bg-calm-50 px-3 py-1.5 text-xs font-semibold text-calm-700">
              Abrir chat
            </span>
          </Link>
        </div>
      </main>

      <footer className="mx-auto mt-4 w-full max-w-lg text-center text-xs text-slate-500">
        Em caso de emergência emocional, você também pode ligar gratuitamente para o{' '}
        <a href="tel:188" className="font-semibold text-calm-700 underline">
          CVV (188)
        </a>{' '}
        a qualquer hora.
      </footer>

      {isCrisisActive && (
        <CrisisOverlay
          friendName={friendName}
          emergencyContactName={user?.preferences?.contatoEmergenciaNome}
          emergencyContactPhone={user?.preferences?.contatoEmergenciaTelefone}
          onStop={deactivatePanicMode}
        />
      )}
    </div>
  );
}
