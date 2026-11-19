import { CheckCircle2, MessageCircleHeart, Music, PhoneCall, SkipForward } from 'lucide-react';
import { useState } from 'react';
import type { CuratedTrack } from '../../hooks/usePanicMode';
import { FriendChatPanel } from '../chat/FriendChatPanel';
import { BreathingGuide } from './BreathingGuide';

interface CrisisOverlayProps {
  currentTrack: CuratedTrack | null;
  audioError: string | null;
  friendName?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  onSwitchTrack: () => Promise<void>;
  onStop: () => void;
}

export function CrisisOverlay({
  currentTrack,
  audioError,
  friendName = 'Amigo',
  emergencyContactName,
  emergencyContactPhone,
  onSwitchTrack,
  onStop,
}: CrisisOverlayProps) {
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo Crise Ativo"
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto bg-gradient-to-b from-calm-900 via-calm-800 to-slate-900 px-5 py-6 text-white"
    >
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-calm-100">
          Você está seguro. Isso vai passar.
        </span>
      </div>

      <div className="my-4 flex flex-col items-center">
        <BreathingGuide />

        <div className="mt-5 w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center backdrop-blur">
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-calm-200">
            <Music className="h-3.5 w-3.5" />
            Tocando agora (Offline-First)
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-white">
            {currentTrack?.title ?? 'Melodia Acolhedora'}
          </p>
          <p className="truncate text-xs text-calm-200">
            {currentTrack?.artist ?? 'Respira'}
          </p>
          {audioError && (
            <p className="mt-2 text-xs text-amber-200">{audioError}</p>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-sm space-y-3">
        {/* Botão de Acesso Rápido ao Pop-up de Conversa com o Amigo */}
        <button
          type="button"
          onClick={() => setIsChatPopupOpen(true)}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-calm-300 bg-gradient-to-r from-calm-500 to-teal-500 px-4 py-4 text-sm font-bold text-white shadow-xl shadow-teal-950/50 transition hover:from-calm-400 hover:to-teal-400 active:scale-[0.99]"
        >
          <MessageCircleHeart className="h-5 w-5 shrink-0" />
          <span>Conversar com {friendName} agora (Texto ou Áudio)</span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void onSwitchTrack()}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <SkipForward className="h-4 w-4" />
            Trocar Música
          </button>

          <button
            type="button"
            onClick={onStop}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4" />
            Estou Melhor
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
          <a
            href="tel:188"
            className="flex items-center justify-center gap-2 rounded-2xl border border-rose-300/40 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
          >
            <PhoneCall className="h-4 w-4" />
            Ligar CVV (188)
          </a>

          {emergencyContactPhone && (
            <a
              href={`tel:${emergencyContactPhone}`}
              className="flex items-center justify-center gap-2 rounded-2xl border border-calm-300/40 bg-calm-500/25 px-4 py-3 text-sm font-semibold text-calm-50 transition hover:bg-calm-500/35"
            >
              <PhoneCall className="h-4 w-4" />
              Ligar {emergencyContactName || 'Emergência'}
            </a>
          )}
        </div>
      </div>

      {/* Modal / Pop-up Imediato de Conversa com o Amigo */}
      {isChatPopupOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Conversa imediata com ${friendName}`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
        >
          <div className="flex h-[88vh] w-full max-w-2xl flex-col">
            <FriendChatPanel
              isCrisisPopup
              onClose={() => setIsChatPopupOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
