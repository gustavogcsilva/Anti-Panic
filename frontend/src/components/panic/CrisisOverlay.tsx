import { CheckCircle2, MessageCircleHeart, PhoneCall } from 'lucide-react';
import { useState } from 'react';
import { FriendChatPanel } from '../chat/FriendChatPanel';
import { RelaxingMusicPlayer } from '../music/RelaxingMusicPlayer';
import { BreathingGuide } from './BreathingGuide';

interface CrisisOverlayProps {
  friendName?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  onStop: () => void;
}

export function CrisisOverlay({
  friendName = 'Amigo',
  emergencyContactName,
  emergencyContactPhone,
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

      <div className="mx-auto my-4 flex w-full max-w-md flex-col items-center gap-5">
        <BreathingGuide />

        {/* Player de Música completo sempre visível no Modo Crise */}
        <RelaxingMusicPlayer variant="crisis" />
      </div>

      <div className="mx-auto w-full max-w-md space-y-3">
        {/* Botão de Acesso Rápido ao Pop-up de Conversa com o Amigo */}
        <button
          type="button"
          onClick={() => setIsChatPopupOpen(true)}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-calm-300 bg-gradient-to-r from-calm-500 to-teal-500 px-4 py-4 text-sm font-bold text-white shadow-xl shadow-teal-950/50 transition hover:from-calm-400 hover:to-teal-400 active:scale-[0.99]"
        >
          <MessageCircleHeart className="h-5 w-5 shrink-0" />
          <span>Conversar com {friendName} agora (Texto ou Áudio)</span>
        </button>

        <button
          type="button"
          onClick={onStop}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-emerald-400"
        >
          <CheckCircle2 className="h-4 w-4" />
          Estou Melhor — Encerrar Modo Crise
        </button>

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
