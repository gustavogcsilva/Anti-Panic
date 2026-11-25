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
import { api } from '../services/api';
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
  selectedArtist: string;
  isPlaying: boolean;
  isLooping: boolean;
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
  setSelectedArtist: (artist: string) => void;
  toggleLoop: () => void;
  playTrack: (track?: CuratedTrack) => Promise<void>;
  playRandomByArtist: (artistOverride?: string) => Promise<void>;
  playNextRandomSameArtist: () => Promise<void>;
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
  const [selectedArtist, setSelectedArtist] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
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
  const selectedArtistRef = useRef('');
  const isLoopingRef = useRef(true);
  const volumeRef = useRef(0.85);
  const isMutedRef = useRef(false);
  const errorRetryCountRef = useRef(0);

  const safeIndex = tracks.length > 0 ? currentIndex % tracks.length : 0;
  const currentTrack = tracks[safeIndex] ?? LOCAL_FALLBACK_TRACK;

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    selectedArtistRef.current = selectedArtist;
  }, [selectedArtist]);

  useEffect(() => {
    isLoopingRef.current = isLooping;
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

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

  // Instância única de <audio> com crossOrigin="anonymous", loop e playsInline (iOS Safari)
  const getAudioElement = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.loop = isLoopingRef.current;
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
      setDuration(targetTrack.duration || 30);
      setAudioError(null);
      setIsBuffering(true);

      const audio = getAudioElement();
      const synthPreset = extractSynthPreset(targetTrack);

      // 1. Paisagem Sonora em tempo real via Web Audio API
      if (synthPreset) {
        try {
          audio.pause();
          await webAudioSynthesizer.start(synthPreset, volumeRef.current, isMutedRef.current);
          setPlaybackStatus('offline');
          setIsPlaying(true);
          setIsBuffering(false);
          errorRetryCountRef.current = 0;
          startSynthTimer(targetTrack.duration || 600);
          return;
        } catch {
          setIsBuffering(false);
          setIsPlaying(false);
          setAudioError('Toque no botão Play para liberar o áudio no seu dispositivo.');
          return;
        }
      }

      // 2. Arquivo de Áudio (Deezer / iTunes / Local WAV / Blob Offline) via <audio crossOrigin="anonymous">
      webAudioSynthesizer.stop();
      stopSynthTimer();

      const offlineUrl = await getOfflineTrackObjectUrl(targetTrack);
      const isExternalStream =
        !offlineUrl &&
        (targetTrack.source === 'deezer' ||
          targetTrack.source === 'itunes' ||
          targetTrack.audioUrl.startsWith('https://'));

      const resolvedUrl = offlineUrl ?? targetTrack.audioUrl ?? LOCAL_FALLBACK_AUDIO_URL;

      try {
        audio.pause();
        audio.crossOrigin = 'anonymous';
        audio.src = resolvedUrl;
        audio.loop = isLoopingRef.current;
        audio.volume = volumeRef.current;
        audio.muted = isMutedRef.current;
        audio.currentTime = 0;
        audio.load();

        setPlaybackStatus(isExternalStream ? 'online' : 'offline');
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }

        setIsPlaying(true);
        setIsBuffering(false);
        errorRetryCountRef.current = 0;
      } catch {
        // Fallback automático sem travar o player
        try {
          await webAudioSynthesizer.start('rain', volumeRef.current, isMutedRef.current);
          setPlaybackStatus('offline');
          setIsPlaying(true);
          setIsBuffering(false);
          startSynthTimer(600);
          setAudioError(
            'Não foi possível tocar a prévia externa agora. Ativamos o som de chuva suave offline.'
          );
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

  /**
   * Etapa 2: Sorteia uma música aleatória por cantor via GET /api/music/random?artist=...
   * (Deezer API -> Fallback iTunes -> Fallback local seguro).
   */
  const playRandomByArtist = useCallback(
    async (artistOverride?: string) => {
      const targetArtist = (artistOverride ?? selectedArtistRef.current).trim();
      if (artistOverride !== undefined) {
        setSelectedArtist(targetArtist);
        selectedArtistRef.current = targetArtist;
      }

      setAudioError(null);

      if (!navigator.onLine) {
        setAudioError(
          'Você está offline. Reproduzindo uma paisagem sonora relaxante salva no dispositivo.'
        );
        await playTrackInternal(DEFAULT_RELAXING_CATALOG[0], DEFAULT_RELAXING_CATALOG);
        return;
      }

      setIsLoadingTracks(true);
      setPlaybackStatus('loading');

      try {
        const randomRes = await api.getRandomTrackByArtist(targetArtist || undefined);

        const newTrack: CuratedTrack = {
          id: randomRes.id,
          title: randomRes.title,
          artist: randomRes.artist,
          album: randomRes.album,
          coverUrl: randomRes.cover,
          audioUrl: randomRes.audioUrl,
          downloadUrl: randomRes.audioUrl,
          duration: randomRes.duration || 30,
          genre: randomRes.source === 'local' ? 'piano' : randomRes.source,
          moodTag: 'relaxing',
          source: randomRes.source,
          isCached: randomRes.source === 'local',
        };

        // Mantém o artista sorteado para o botão "Próxima Aleatória" do mesmo cantor
        if (!targetArtist && randomRes.artist) {
          setSelectedArtist(randomRes.artist);
          selectedArtistRef.current = randomRes.artist;
        }

        const updatedList = [
          newTrack,
          ...tracksRef.current.filter((t) => t.id !== newTrack.id),
        ].slice(0, 15);

        tracksRef.current = updatedList;
        setTracks(updatedList);
        setCurrentIndex(0);
        currentTrackRef.current = newTrack;

        await playTrackInternal(newTrack, updatedList);
      } catch {
        setAudioError(
          'Não foi possível sortear uma música online agora. Reproduzindo som relaxante local.'
        );
        await playTrackInternal(DEFAULT_RELAXING_CATALOG[0], DEFAULT_RELAXING_CATALOG);
      } finally {
        setIsLoadingTracks(false);
      }
    },
    [playTrackInternal]
  );

  const playNextRandomSameArtist = useCallback(async () => {
    const artistToUse =
      selectedArtistRef.current.trim() ||
      (currentTrackRef.current.source === 'deezer' || currentTrackRef.current.source === 'itunes'
        ? currentTrackRef.current.artist
        : '');
    await playRandomByArtist(artistToUse);
  }, [playRandomByArtist]);

  const refreshTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    setAudioError(null);

    try {
      const saved = await loadSavedTracksMetadata();
      const validSaved = saved.filter(
        (t) =>
          t.source === 'synthesizer' ||
          t.source === 'local' ||
          t.source === 'deezer' ||
          t.source === 'itunes'
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
    if (navigator.onLine) {
      await playRandomByArtist(selectedArtistRef.current);
      return;
    }
    const list = tracksRef.current.length > 0 ? tracksRef.current : DEFAULT_RELAXING_CATALOG;
    const currentId = currentTrackRef.current.id;
    const candidates = list.filter((t) => t.id !== currentId);
    const picked =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : list[0];
    await playTrackInternal(picked, list);
  }, [playRandomByArtist, playTrackInternal]);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

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

  // Liga eventos nativos do <audio> incluindo onError com sorteio automático de outra faixa
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
      if (webAudioSynthesizer.isRunning()) return;
      setIsBuffering(false);

      // Tenta sortear automaticamente outra música sem travar o player (máximo 2 tentativas)
      if (navigator.onLine && errorRetryCountRef.current < 2) {
        errorRetryCountRef.current += 1;
        setAudioError('Prévia indisponível. Sorteando automaticamente outra música...');
        void playRandomByArtist(selectedArtistRef.current);
      } else {
        errorRetryCountRef.current = 0;
        setAudioError(
          'Faixa externa indisponível no momento. Ativando som relaxante offline.'
        );
        void playTrackInternal(DEFAULT_RELAXING_CATALOG[0], DEFAULT_RELAXING_CATALOG);
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
  }, [getAudioElement, playRandomByArtist, playTrackInternal]);

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
      selectedArtist,
      isPlaying,
      isLooping,
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
      setSelectedArtist,
      toggleLoop,
      playTrack,
      playRandomByArtist,
      playNextRandomSameArtist,
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
      selectedArtist,
      isPlaying,
      isLooping,
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
      toggleLoop,
      playTrack,
      playRandomByArtist,
      playNextRandomSameArtist,
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
