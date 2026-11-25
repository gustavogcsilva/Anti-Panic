import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  cacheTrackOffline,
  clearOfflineAudioCache,
  getOfflineCacheStats,
  getOfflineTrackObjectUrl,
  loadSavedTracksMetadata,
  saveTracksMetadata,
  type OfflineCacheStats,
} from '../services/musicOfflineCache';
import {
  DEFAULT_RELAXING_CATALOG,
  LOCAL_FALLBACK_AUDIO_URL,
  LOCAL_FALLBACK_TRACK,
  fetchCuratedRelaxingTracks,
  filterLocalCatalog,
  searchRelaxingTracks,
} from '../services/relaxingAudioService';
import { webAudioSynthesizer } from '../services/webAudioSynthesizer';
import type { CuratedTrack, SynthPreset } from '../types';
import { useAuth } from './AuthContext';

export type PlaybackSourceStatus = 'offline' | 'online' | 'loading' | 'idle';

interface MusicPlayerContextValue {
  tracks: CuratedTrack[];
  currentTrack: CuratedTrack;
  currentIndex: number;
  isPlaying: boolean;
  isLoadingTracks: boolean;
  isBuffering: boolean;
  downloadingTrackId: string | null;
  playbackStatus: PlaybackSourceStatus;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  audioError: string | null;
  isOnline: boolean;
  cacheStats: OfflineCacheStats;
  activeSearchQuery: string;
  playTrack: (track?: CuratedTrack) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  discoverNewTrack: () => Promise<void>;
  seekTo: (seconds: number) => void;
  setVolume: (nextVolume: number) => void;
  toggleMute: () => void;
  refreshTracks: () => Promise<void>;
  searchTracks: (query: string) => Promise<void>;
  saveTrackOffline: (track: CuratedTrack) => Promise<boolean>;
  clearCache: () => Promise<void>;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

function extractSynthPreset(track: CuratedTrack): SynthPreset | null {
  if (track.synthPreset) return track.synthPreset;
  if (track.audioUrl.startsWith('synth://')) {
    return track.audioUrl.replace('synth://', '') as SynthPreset;
  }
  return null;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();

  const [tracks, setTracks] = useState<CuratedTrack[]>(DEFAULT_RELAXING_CATALOG);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackSourceStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(LOCAL_FALLBACK_TRACK.duration);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cacheStats, setCacheStats] = useState<OfflineCacheStats>({
    cachedCount: DEFAULT_RELAXING_CATALOG.length,
    totalSizeBytes: 793_932,
  });
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthTimerRef = useRef<number | null>(null);
  const tracksRef = useRef<CuratedTrack[]>(DEFAULT_RELAXING_CATALOG);
  const currentTrackRef = useRef<CuratedTrack>(LOCAL_FALLBACK_TRACK);
  const volumeRef = useRef(0.85);
  const isMutedRef = useRef(false);

  const safeIndex = tracks.length > 0 ? currentIndex % tracks.length : 0;
  const currentTrack = tracks[safeIndex] ?? LOCAL_FALLBACK_TRACK;

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const stopSynthTimer = useCallback(() => {
    if (synthTimerRef.current !== null) {
      window.clearInterval(synthTimerRef.current);
      synthTimerRef.current = null;
    }
  }, []);

  const startSynthTimer = useCallback(
    (maxDuration: number) => {
      stopSynthTimer();
      synthTimerRef.current = window.setInterval(() => {
        setCurrentTime((prev) => (prev + 1 >= maxDuration ? 0 : prev + 1));
      }, 1000);
    },
    [stopSynthTimer]
  );

  // Instância única e persistente de <audio> com crossOrigin="anonymous" e playsInline para iOS Safari
  const getAudioElement = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = volumeRef.current;
      audio.muted = isMutedRef.current;
      (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      audio.setAttribute('playsinline', 'true');
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const refreshCacheStats = useCallback(async () => {
    const stats = await getOfflineCacheStats();
    setCacheStats(stats);
  }, []);

  const saveTrackOffline = useCallback(
    async (track: CuratedTrack): Promise<boolean> => {
      setDownloadingTrackId(track.id);
      try {
        const res = await cacheTrackOffline(track);
        await refreshCacheStats();
        return res.ok;
      } finally {
        setDownloadingTrackId(null);
      }
    },
    [refreshCacheStats]
  );

  /**
   * Reproduz uma faixa:
   * - Se for paisagem sonora Web Audio API (synth://...), inicia o sintetizador instantaneamente (0ms, offline).
   * - Se for arquivo de áudio (local WAV em public/audio/ ou blob em cache), reproduz via <audio crossOrigin="anonymous">.
   * - Caso o elemento <audio> falhe (onError / bloqueio), cai automaticamente para o sintetizador de chuva suave!
   */
  const playTrackInternal = useCallback(
    async (explicitTrack?: CuratedTrack, customTrackList?: CuratedTrack[]): Promise<void> => {
      const activeList =
        customTrackList && customTrackList.length > 0 ? customTrackList : tracksRef.current;
      const targetTrack = explicitTrack ?? currentTrackRef.current ?? LOCAL_FALLBACK_TRACK;

      const foundIdx = activeList.findIndex((t) => t.id === targetTrack.id);
      if (foundIdx >= 0) {
        setCurrentIndex(foundIdx);
      }
      currentTrackRef.current = targetTrack;
      setCurrentTime(0);
      setDuration(targetTrack.duration || 600);
      setAudioError(null);
      setIsBuffering(true);

      const audio = getAudioElement();
      const synthPreset = extractSynthPreset(targetTrack);

      // 1. Paisagem Sonora em tempo real via Web Audio API (Chuva, Ruído Marrom/Rosa/Branco, Ondas, Zen)
      if (synthPreset) {
        try {
          audio.pause();
          await webAudioSynthesizer.start(synthPreset, volumeRef.current, isMutedRef.current);
          setPlaybackStatus('offline');
          setIsPlaying(true);
          setIsBuffering(false);
          startSynthTimer(targetTrack.duration || 600);
          return;
        } catch {
          setIsBuffering(false);
          setIsPlaying(false);
          setAudioError('Toque no botão Play para liberar o áudio no seu dispositivo.');
          return;
        }
      }

      // 2. Arquivo de Áudio via HTML5 <audio crossOrigin="anonymous">
      webAudioSynthesizer.stop();
      stopSynthTimer();

      const resolvedUrl =
        (await getOfflineTrackObjectUrl(targetTrack)) ??
        targetTrack.audioUrl ??
        LOCAL_FALLBACK_AUDIO_URL;

      try {
        audio.pause();
        audio.crossOrigin = 'anonymous';
        audio.src = resolvedUrl;
        audio.loop = true;
        audio.volume = volumeRef.current;
        audio.muted = isMutedRef.current;
        audio.currentTime = 0;
        audio.load();

        setPlaybackStatus('offline');
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }

        setIsPlaying(true);
        setIsBuffering(false);
      } catch {
        // Fallback automático e instantâneo para o sintetizador de chuva (Web Audio API)
        try {
          await webAudioSynthesizer.start('rain', volumeRef.current, isMutedRef.current);
          setPlaybackStatus('offline');
          setIsPlaying(true);
          setIsBuffering(false);
          startSynthTimer(600);
        } catch {
          setIsBuffering(false);
          setIsPlaying(false);
          setPlaybackStatus('idle');
          setAudioError('Toque no botão Play para iniciar o som relaxante.');
        }
      }
    },
    [getAudioElement, startSynthTimer, stopSynthTimer]
  );

  const playTrack = useCallback(
    async (explicitTrack?: CuratedTrack) => {
      await playTrackInternal(explicitTrack);
    },
    [playTrackInternal]
  );

  const refreshTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    setAudioError(null);

    try {
      const saved = await loadSavedTracksMetadata();
      const validSaved = saved.filter(
        (t) => t.source === 'synthesizer' || t.source === 'local'
      );
      if (validSaved.length > 0) {
        tracksRef.current = validSaved;
        setTracks(validSaved);
      }

      if (navigator.onLine && isAuthenticated) {
        const incoming = await fetchCuratedRelaxingTracks(token);
        if (incoming.length > 0) {
          tracksRef.current = incoming;
          setTracks(incoming);
          setActiveSearchQuery('');
          await saveTracksMetadata(incoming);
        }
      }
    } catch {
      tracksRef.current = DEFAULT_RELAXING_CATALOG;
      setTracks(DEFAULT_RELAXING_CATALOG);
    } finally {
      setIsLoadingTracks(false);
      await refreshCacheStats();
    }
  }, [isAuthenticated, refreshCacheStats, token]);

  const searchTracks = useCallback(
    async (query: string) => {
      const cleaned = query.trim();
      setActiveSearchQuery(cleaned);
      setAudioError(null);
      setIsLoadingTracks(true);

      try {
        const results = navigator.onLine
          ? await searchRelaxingTracks(cleaned, token)
          : filterLocalCatalog(cleaned);

        const finalTracks = results.length > 0 ? results : DEFAULT_RELAXING_CATALOG;
        tracksRef.current = finalTracks;
        setTracks(finalTracks);
        setCurrentIndex(0);
        currentTrackRef.current = finalTracks[0];
        await saveTracksMetadata(finalTracks);
        await playTrackInternal(finalTracks[0], finalTracks);
      } finally {
        setIsLoadingTracks(false);
      }
    },
    [playTrackInternal, token]
  );

  const discoverNewTrack = useCallback(async () => {
    setAudioError(null);
    const list = tracksRef.current.length > 0 ? tracksRef.current : DEFAULT_RELAXING_CATALOG;
    const currentId = currentTrackRef.current.id;
    const candidates = list.filter((t) => t.id !== currentId);
    const picked =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : list[0];

    await playTrackInternal(picked, list);
  }, [playTrackInternal]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    webAudioSynthesizer.stop();
    stopSynthTimer();
    setIsPlaying(false);
    setIsBuffering(false);
  }, [stopSynthTimer]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    webAudioSynthesizer.stop();
    stopSynthTimer();
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
  }, [stopSynthTimer]);

  const togglePlayPause = useCallback(async () => {
    if (isPlaying) {
      pause();
      return;
    }
    await playTrackInternal(currentTrackRef.current);
  }, [isPlaying, pause, playTrackInternal]);

  const nextTrack = useCallback(async () => {
    const list = tracksRef.current;
    if (list.length === 0) {
      await playTrackInternal(LOCAL_FALLBACK_TRACK);
      return;
    }
    const nextIdx = (currentIndex + 1) % list.length;
    setCurrentIndex(nextIdx);
    await playTrackInternal(list[nextIdx], list);
  }, [currentIndex, playTrackInternal]);

  const previousTrack = useCallback(async () => {
    const list = tracksRef.current;
    if (list.length === 0) {
      await playTrackInternal(LOCAL_FALLBACK_TRACK);
      return;
    }
    const prevIdx = (currentIndex - 1 + list.length) % list.length;
    setCurrentIndex(prevIdx);
    await playTrackInternal(list[prevIdx], list);
  }, [currentIndex, playTrackInternal]);

  const seekTo = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds)) return;
    if (extractSynthPreset(currentTrackRef.current)) {
      setCurrentTime(Math.max(0, Math.min(seconds, currentTrackRef.current.duration || 600)));
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration || seconds));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, nextVolume));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (clamped > 0 && isMutedRef.current) {
      isMutedRef.current = false;
      setIsMuted(false);
      webAudioSynthesizer.setMuted(false);
    }
    webAudioSynthesizer.setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      audioRef.current.muted = isMutedRef.current;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    webAudioSynthesizer.setMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
  }, []);

  const clearCache = useCallback(async () => {
    await clearOfflineAudioCache();
    await refreshCacheStats();
  }, [refreshCacheStats]);

  // Liga eventos nativos do <audio> (incluindo tratamento de onError)
  useEffect(() => {
    const audio = getAudioElement();

    const handleTimeUpdate = () => {
      if (!webAudioSynthesizer.isRunning()) {
        setCurrentTime(audio.currentTime || 0);
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      if (!webAudioSynthesizer.isRunning()) {
        setIsPlaying(false);
      }
    };
    const handleError = () => {
      if (!webAudioSynthesizer.isRunning()) {
        setIsBuffering(false);
        setAudioError(
          'Não foi possível reproduzir o arquivo de áudio. Selecione outra paisagem sonora ou toque em Nova Música.'
        );
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [getAudioElement]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isAuthenticated) void refreshTracks();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (isAuthenticated) {
      void refreshTracks();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated, refreshTracks]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      webAudioSynthesizer.stop();
      stopSynthTimer();
    };
  }, [stopSynthTimer]);

  const value = useMemo<MusicPlayerContextValue>(
    () => ({
      tracks,
      currentTrack,
      currentIndex: safeIndex,
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
      pause,
      stop,
      nextTrack,
      previousTrack,
      discoverNewTrack,
      seekTo,
      setVolume,
      toggleMute,
      refreshTracks,
      searchTracks,
      saveTrackOffline,
      clearCache,
    }),
    [
      tracks,
      currentTrack,
      safeIndex,
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
      pause,
      stop,
      nextTrack,
      previousTrack,
      discoverNewTrack,
      seekTo,
      setVolume,
      toggleMute,
      refreshTracks,
      searchTracks,
      saveTrackOffline,
      clearCache,
    ]
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer(): MusicPlayerContextValue {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error('useMusicPlayer deve ser utilizado dentro de um MusicPlayerProvider.');
  }
  return ctx;
}
