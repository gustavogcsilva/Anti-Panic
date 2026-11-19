import { CheckCircle2, Music, PhoneCall, SkipForward } from 'lucide-react';
import type { CuratedTrack } from '../../hooks/usePanicMode';
import { BreathingGuide } from './BreathingGuide';

interface CrisisOverlayProps {
  currentTrack: CuratedTrack | null;
  audioError: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  onSwitchTrack: () => Promise<void>;
  onStop: () => void;
}

export function CrisisOverlay({
  currentTrack,
  audioError,
  emergencyContactName,
  emergencyContactPhone,
  onSwitchTrack,
  onStop,
}: CrisisOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo Crise Ativo"
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto bg-gradient-to-b from-calm-900 via-calm-800 to-slate-900 px-5 py-8 text-white"
    >
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-calm-100">
          Você está seguro. Isso vai passar.
        </span>
      </div>

      <div className="my-6 flex flex-col items-center">
        <BreathingGuide />

        <div className="mt-7 w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center backdrop-blur">
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

        <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-2">
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
    </div>
  );
}
