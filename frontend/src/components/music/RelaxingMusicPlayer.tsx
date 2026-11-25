import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  CloudOff,
  Loader2,
  Music,
  Pause,
  Play,
  Radio,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';

interface RelaxingMusicPlayerProps {
  /** 'full' para a tela principal (Home) com busca e playlist; 'crisis' para o overlay do Botão de Pânico */
  variant?: 'full' | 'crisis';
}

const MOOD_SEARCH_CHIPS = [
  { label: 'Chuva', query: 'chuva' },
  { label: 'Ruído Marrom', query: 'marrom' },
  { label: 'Ondas do Mar', query: 'ondas' },
  { label: 'Piano', query: 'piano' },
  { label: 'Meditação', query: 'meditação' },
  { label: 'Ruído Rosa', query: 'rosa' },
];

function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb < 0.1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`;
}

export function RelaxingMusicPlayer({ variant = 'full' }: RelaxingMusicPlayerProps) {
  const {
    tracks,
    currentTrack,
    isPlaying,
    isLoadingTracks,
    isBuffering,
    downloadingTrackId,
    playbackStatus,
    currentTime,
    duration,
    volume,
    isMuted,
    audioError,
    isOnline,
    cacheStats,
    activeSearchQuery,
    playTrack,
    togglePlayPause,
    nextTrack,
    previousTrack,
    discoverNewTrack,
    seekTo,
    setVolume,
    toggleMute,
    searchTracks,
    saveTrackOffline,
    clearCache,
  } = useMusicPlayer();

  const [searchInput, setSearchInput] = useState(activeSearchQuery);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const isCrisisStyle = variant === 'crisis';
  const effectiveDuration = duration > 0 ? duration : currentTrack.duration || 0;
  const progressValue =
    effectiveDuration > 0 ? Math.min(currentTime, effectiveDuration) : 0;

  const isCurrentCached =
    Boolean(currentTrack.isCached) ||
    currentTrack.source === 'local' ||
    playbackStatus === 'offline';

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

    if (isCurrentCached) {
      return {
        label: 'Baixado (Offline)',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        className: isCrisisStyle
          ? 'bg-emerald-400/20 text-emerald-100 border-emerald-300/40'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      };
    }

    return {
      label: 'Online (Streaming)',
      icon: <Radio className="h-3.5 w-3.5" />,
      className: isCrisisStyle
        ? 'bg-sky-400/20 text-sky-100 border-sky-300/40'
        : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    };
  };

  const statusBadge = getStatusBadge();

  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await searchTracks(searchInput);
    setShowPlaylist(true);
  };

  const handleMoodClick = async (query: string) => {
    setSearchInput(query);
    await searchTracks(query);
    setShowPlaylist(true);
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearCache();
    } finally {
      setIsClearingCache(false);
    }
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
      {/* Topo: Capa + Título + Artista + Badge de Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {currentTrack.coverUrl ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
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
              className={`truncate text-xs ${
                isCrisisStyle ? 'text-calm-200' : 'text-slate-500'
              }`}
            >
              {currentTrack.artist}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadge.className}`}
        >
          {statusBadge.icon}
          <span>{statusBadge.label}</span>
        </span>
      </div>

      {/* Barra de Progresso Interativa com Tempo Atual e Duração Total */}
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

      {/* Controles Principais: Anterior / Play-Pause / Próxima + Volume & Mute + Salvar Offline */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void previousTrack()}
            title="Música anterior"
            aria-label="Música anterior"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 ${
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
            title="Próxima música"
            aria-label="Próxima música"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 ${
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
            onClick={() => void discoverNewTrack()}
            title="Sortear e tocar outro som relaxante"
            aria-label="Nova Música"
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${
              isCrisisStyle
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-calm-100 text-calm-800 hover:bg-calm-200'
            }`}
          >
            <Shuffle className={`h-3.5 w-3.5 ${isLoadingTracks ? 'animate-spin' : ''}`} />
            <span>Nova Música</span>
          </button>
        </div>

        {/* Controle de Volume / Mute */}
        <div className="flex items-center gap-2">
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
            className={`h-1.5 w-20 cursor-pointer appearance-none rounded-lg sm:w-24 ${
              isCrisisStyle
                ? 'bg-white/25 accent-emerald-400'
                : 'bg-calm-100 accent-calm-600'
            }`}
          />

          {/* Botão Salvar Offline da faixa atual */}
          {currentTrack.source !== 'local' && !isCurrentCached && isOnline && (
            <button
              type="button"
              disabled={downloadingTrackId === currentTrack.id}
              onClick={() => void saveTrackOffline(currentTrack)}
              title="Salvar esta música no celular para ouvir sem internet"
              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                isCrisisStyle
                  ? 'bg-white/15 text-white hover:bg-white/25'
                  : 'bg-calm-100 text-calm-800 hover:bg-calm-200'
              }`}
            >
              {downloadingTrackId === currentTrack.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CloudDownload className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Salvar Offline</span>
            </button>
          )}
        </div>
      </div>

      {/* Mensagem de erro / feedback amigável */}
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

      {/* Modo Completo (Home): Busca de Músicas, Playlist e Gerenciador de Cache Offline */}
      {!isCrisisStyle && (
        <div className="mt-4 space-y-3 border-t border-calm-100 pt-3">
          {/* Campo de busca de músicas no Jamendo */}
          <form onSubmit={(e) => void handleSearchSubmit(e)} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar som relaxante (chuva, ruído marrom, ondas, piano...)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-calm-500 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingTracks}
              className="inline-flex shrink-0 items-center gap-1 rounded-2xl bg-calm-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-calm-700 disabled:opacity-50"
            >
              {isLoadingTracks ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Buscar
            </button>
          </form>

          {/* Chips rápidos de humor */}
          <div className="flex flex-wrap gap-1.5">
            {MOOD_SEARCH_CHIPS.map((chip) => (
              <button
                key={chip.query}
                type="button"
                disabled={isLoadingTracks}
                onClick={() => void handleMoodClick(chip.query)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                  activeSearchQuery.toLowerCase() === chip.query
                    ? 'bg-calm-600 text-white'
                    : 'bg-calm-50 text-calm-800 hover:bg-calm-100'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Barra de Resumo do Cache Offline + Botão Limpar Cache + Alternar Playlist */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <div className="inline-flex items-center gap-1.5 text-slate-600">
              {isOnline ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <CloudOff className="h-3.5 w-3.5 text-amber-600" />
              )}
              <span>
                {cacheStats.cachedCount > 0
                  ? `${cacheStats.cachedCount} offline (${formatBytes(cacheStats.totalSizeBytes)})`
                  : 'Áudio local de emergência pronto'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {cacheStats.cachedCount > 0 && (
                <button
                  type="button"
                  disabled={isClearingCache}
                  onClick={() => void handleClearCache()}
                  title="Remover arquivos MP3 baixados para liberar espaço no celular"
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {isClearingCache ? 'Limpando...' : 'Limpar Cache'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowPlaylist((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-xl bg-calm-50 px-2.5 py-1 text-[11px] font-semibold text-calm-800 transition hover:bg-calm-100"
              >
                <span>Faixas ({tracks.length})</span>
                {showPlaylist ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Lista expansível de músicas com botão Salvar Offline individual */}
          {showPlaylist && (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1 pt-1 text-left">
              {tracks.map((track) => {
                const isSelected = track.id === currentTrack.id;
                const trackCached = Boolean(track.isCached) || track.source === 'local';
                const isDownloadingThis = downloadingTrackId === track.id;

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

                    {trackCached ? (
                      <span
                        title="Disponível sem internet"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Offline
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!isOnline || isDownloadingThis}
                        onClick={() => void saveTrackOffline(track)}
                        title="Salvar MP3 no cache offline do celular"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-calm-100 px-2.5 py-1 text-[10px] font-semibold text-calm-800 transition hover:bg-calm-200 disabled:opacity-50"
                      >
                        {isDownloadingThis ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CloudDownload className="h-3 w-3" />
                        )}
                        Salvar Offline
                      </button>
                    )}
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
