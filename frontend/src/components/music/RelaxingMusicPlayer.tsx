import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudOff,
  Loader2,
  Music,
  Pause,
  Play,
  Radio,
  Repeat,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';

interface RelaxingMusicPlayerProps {
  /** 'full' para a tela principal (Home) com sorteio por cantor e sons offline; 'crisis' para o overlay */
  variant?: 'full' | 'crisis';
}

const SUGGESTED_CALM_ARTISTS = [
  'Ludovico Einaudi',
  'Nils Frahm',
  'Max Richter',
  'Yiruma',
  'Coldplay',
  'Jack Johnson',
];

const OFFLINE_SOUNDSCAPE_CHIPS = [
  { label: 'Chuva', query: 'chuva' },
  { label: 'Ruído Marrom', query: 'marrom' },
  { label: 'Ondas do Mar', query: 'ondas' },
  { label: 'Piano Offline', query: 'piano' },
  { label: 'Meditação', query: 'meditação' },
];

function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function RelaxingMusicPlayer({ variant = 'full' }: RelaxingMusicPlayerProps) {
  const {
    tracks,
    currentTrack,
    selectedArtist,
    isPlaying,
    isLooping,
    isLoadingTracks,
    isBuffering,
    playbackStatus,
    currentTime,
    duration,
    volume,
    isMuted,
    audioError,
    isOnline,
    setSelectedArtist,
    toggleLoop,
    playTrack,
    playRandomByArtist,
    playNextRandomSameArtist,
    togglePlayPause,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    toggleMute,
    searchTracks,
  } = useMusicPlayer();

  const [showPlaylist, setShowPlaylist] = useState(false);

  const isCrisisStyle = variant === 'crisis';
  const effectiveDuration = duration > 0 ? duration : currentTrack.duration || 30;
  const progressValue =
    effectiveDuration > 0 ? Math.min(currentTime, effectiveDuration) : 0;

  const getStatusBadge = () => {
    if (isLoadingTracks || isBuffering || playbackStatus === 'loading') {
      return {
        label: 'Buscando...',
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        className: isCrisisStyle
          ? 'bg-amber-400/20 text-amber-100 border-amber-300/40'
          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      };
    }

    if (currentTrack.source === 'deezer') {
      return {
        label: 'Deezer (Online)',
        icon: <Radio className="h-3.5 w-3.5" />,
        className: isCrisisStyle
          ? 'bg-sky-400/20 text-sky-100 border-sky-300/40'
          : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
      };
    }

    if (currentTrack.source === 'itunes') {
      return {
        label: 'iTunes (Online)',
        icon: <Radio className="h-3.5 w-3.5" />,
        className: isCrisisStyle
          ? 'bg-indigo-400/20 text-indigo-100 border-indigo-300/40'
          : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
      };
    }

    return {
      label: 'Offline (Web Audio)',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      className: isCrisisStyle
        ? 'bg-emerald-400/20 text-emerald-100 border-emerald-300/40'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    };
  };

  const statusBadge = getStatusBadge();

  const handleArtistSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await playRandomByArtist(selectedArtist);
  };

  return (
    <section
      aria-label="Player de Música Relaxante"
      className={`relative z-30 w-full rounded-3xl border p-4 shadow-lg transition ${
        isCrisisStyle
          ? 'border-white/20 bg-white/10 text-white backdrop-blur-md'
          : 'border-calm-200 bg-white/95 text-slate-800 shadow-calm-900/5'
      }`}
    >
      {/* Topo: Capa do Álbum + Título + Artista + Badge de Origem */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {currentTrack.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.album || currentTrack.title}
              className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-md"
            />
          ) : (
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                isCrisisStyle
                  ? 'bg-white/15 text-calm-100'
                  : 'bg-calm-100 text-calm-700 dark:bg-calm-900/60 dark:text-calm-300'
              }`}
            >
              <Music className="h-6 w-6" />
            </div>
          )}

          <div className="min-w-0 text-left">
            <h3
              className={`truncate text-sm font-bold ${
                isCrisisStyle ? 'text-white' : 'text-slate-800'
              }`}
            >
              {currentTrack.title}
            </h3>
            <p
              className={`truncate text-xs font-medium ${
                isCrisisStyle ? 'text-calm-100' : 'text-slate-600'
              }`}
            >
              {currentTrack.artist}
            </p>
            {currentTrack.album && (
              <p
                className={`truncate text-[11px] ${
                  isCrisisStyle ? 'text-calm-200/80' : 'text-slate-400'
                }`}
              >
                {currentTrack.album}
              </p>
            )}
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadge.className}`}
        >
          {statusBadge.icon}
          <span>{statusBadge.label}</span>
        </span>
      </div>

      {/* Barra de Progresso Interativa */}
      <div className="mt-4">
        <input
          type="range"
          min={0}
          max={Math.max(effectiveDuration, 1)}
          step={0.5}
          value={progressValue}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label="Progresso da música"
          className={`h-1.5 w-full cursor-pointer appearance-none rounded-lg ${
            isCrisisStyle
              ? 'bg-white/25 accent-emerald-400'
              : 'bg-calm-100 accent-calm-600'
          }`}
        />
        <div
          className={`mt-1 flex items-center justify-between text-[11px] font-medium tabular-nums ${
            isCrisisStyle ? 'text-calm-200' : 'text-slate-500'
          }`}
        >
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(effectiveDuration)}</span>
        </div>
      </div>

      {/* Controles Principais: Anterior / Play-Pause / Próxima / Próxima Aleatória / Loop / Volume */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void previousTrack()}
            title="Faixa anterior"
            aria-label="Faixa anterior"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95 ${
              isCrisisStyle
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-calm-50 text-calm-800 hover:bg-calm-100'
            }`}
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => void togglePlayPause()}
            title={isPlaying ? 'Pausar música' : 'Tocar música'}
            aria-label={isPlaying ? 'Pausar música' : 'Tocar música'}
            className={`flex h-12 w-12 items-center justify-center rounded-full shadow-md transition active:scale-95 ${
              isCrisisStyle
                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                : 'bg-calm-600 text-white hover:bg-calm-700'
            }`}
          >
            {isBuffering ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="ml-0.5 h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => void nextTrack()}
            title="Próxima faixa"
            aria-label="Próxima faixa"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95 ${
              isCrisisStyle
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-calm-50 text-calm-800 hover:bg-calm-100'
            }`}
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <button
            type="button"
            disabled={isLoadingTracks}
            onClick={() => void playNextRandomSameArtist()}
            title="Sortear outra música aleatória do mesmo cantor"
            aria-label="Próxima Aleatória"
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${
              isCrisisStyle
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-calm-100 text-calm-800 hover:bg-calm-200'
            }`}
          >
            <Shuffle className={`h-3.5 w-3.5 ${isLoadingTracks ? 'animate-spin' : ''}`} />
            <span>Próxima Aleatória</span>
          </button>

          <button
            type="button"
            onClick={toggleLoop}
            title={isLooping ? 'Repetição (Loop) ativada' : 'Ativar repetição contínua (Loop 30s)'}
            aria-label="Alternar repetição (Loop)"
            className={`inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition ${
              isLooping
                ? isCrisisStyle
                  ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/60'
                  : 'bg-calm-600 text-white'
                : isCrisisStyle
                  ? 'bg-white/10 text-calm-200 hover:bg-white/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Repeat className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Loop</span>
          </button>
        </div>

        {/* Controle de Volume / Mute */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMute}
            title={isMuted || volume === 0 ? 'Ativar som' : 'Silenciar'}
            aria-label={isMuted || volume === 0 ? 'Ativar som' : 'Silenciar'}
            className={`rounded-xl p-2 transition ${
              isCrisisStyle
                ? 'text-calm-100 hover:bg-white/15'
                : 'text-slate-600 hover:bg-calm-50'
            }`}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume do áudio"
            className={`h-1.5 w-20 cursor-pointer appearance-none rounded-lg ${
              isCrisisStyle
                ? 'bg-white/25 accent-emerald-400'
                : 'bg-calm-100 accent-calm-600'
            }`}
          />
        </div>
      </div>

      {/* Feedback de erro / status */}
      {audioError && (
        <p
          role="status"
          className={`mt-3 rounded-xl px-3 py-2 text-xs ${
            isCrisisStyle
              ? 'bg-amber-500/20 text-amber-100'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
          }`}
        >
          {audioError}
        </p>
      )}

      {/* Modo Completo (Home): Busca por Cantor (Deezer/iTunes) + Sons Offline */}
      {!isCrisisStyle && (
        <div className="mt-4 space-y-3 border-t border-calm-100 pt-3">
          {/* Input de Cantor + Botão Tocar Aleatória */}
          <form onSubmit={(e) => void handleArtistSubmit(e)} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={selectedArtist}
                onChange={(e) => setSelectedArtist(e.target.value)}
                placeholder="Digite um cantor (ex: Ludovico Einaudi, Coldplay)..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-calm-500 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingTracks}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-calm-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-calm-700 disabled:opacity-50"
            >
              {isLoadingTracks ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Shuffle className="h-3.5 w-3.5" />
              )}
              Tocar Aleatória
            </button>
          </form>

          {/* Seleção rápida de cantores calmos/instrumentais (Deezer + iTunes) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Cantores:</span>
            {SUGGESTED_CALM_ARTISTS.map((artistName) => (
              <button
                key={artistName}
                type="button"
                disabled={isLoadingTracks}
                onClick={() => void playRandomByArtist(artistName)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                  selectedArtist.toLowerCase() === artistName.toLowerCase()
                    ? 'bg-calm-600 text-white'
                    : 'bg-calm-50 text-calm-800 hover:bg-calm-100'
                }`}
              >
                {artistName}
              </button>
            ))}
          </div>

          {/* Paisagens Sonoras Offline (Web Audio API — funcionam até no modo avião) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                {isOnline ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <CloudOff className="h-3 w-3 text-amber-600" />
                )}
                Sons Offline:
              </span>
              {OFFLINE_SOUNDSCAPE_CHIPS.map((chip) => (
                <button
                  key={chip.query}
                  type="button"
                  onClick={() => void searchTracks(chip.query)}
                  className="rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowPlaylist((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-xl bg-calm-50 px-2.5 py-1 text-[11px] font-semibold text-calm-800 transition hover:bg-calm-100"
            >
              <span>Lista ({tracks.length})</span>
              {showPlaylist ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {showPlaylist && (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1 pt-1 text-left">
              {tracks.map((track) => {
                const isSelected = track.id === currentTrack.id;
                return (
                  <li
                    key={track.id}
                    className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-xs transition ${
                      isSelected
                        ? 'border-calm-400 bg-calm-50/90 dark:bg-calm-900/40'
                        : 'border-slate-100 bg-slate-50/50 hover:bg-calm-50/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void playTrack(track)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          isSelected && isPlaying
                            ? 'bg-calm-600 text-white'
                            : 'bg-white text-calm-700 shadow-sm'
                        }`}
                      >
                        {isSelected && isPlaying ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="ml-0.5 h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{track.title}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {track.artist} • {formatDuration(track.duration)}
                        </p>
                      </div>
                    </button>

                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {track.source === 'deezer'
                        ? 'Deezer'
                        : track.source === 'itunes'
                          ? 'iTunes'
                          : 'Offline'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
