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
  LOCAL_FALLBACK_AUDIO_URL,
  LOCAL_FALLBACK_TRACK,
  buildBackendAudioProxyUrl,
  fetchCuratedRelaxingTracks,
  searchRelaxingTracks,
} from '../services/jamendoService';
import {
  cacheTrackOffline,
  clearOfflineAudioCache,
  getOfflineCacheStats,
  getOfflineTrackObjectUrl,
  isTrackCachedOffline,
  loadSavedTracksMetadata,
  saveTracksMetadata,
  type OfflineCacheStats,
} from '../services/musicOfflineCache';
import type { CuratedTrack } from '../types';
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
  seekTo: (seconds: number) => void;
  setVolume: (nextVolume: number) => void;
  toggleMute: () => void;
  refreshTracks: () => Promise<void>;
  searchTracks: (query: string) => Promise<void>;
  saveTrackOffline: (track: CuratedTrack) => Promise<boolean>;
  clearCache: () => Promise<void>;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();

  const [tracks, setTracks] = useState<CuratedTrack[]>([LOCAL_FALLBACK_TRACK]);
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
    cachedCount: 0,
    totalSizeBytes: 0,
  });
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlCacheRef = useRef<Map<string, string>>(new Map());
  const currentTrackRef = useRef<CuratedTrack>(LOCAL_FALLBACK_TRACK);
  const volumeRef = useRef(0.85);
  const isMutedRef = useRef(false);

  const safeIndex = tracks.length > 0 ? currentIndex % tracks.length : 0;
  const currentTrack = tracks[safeIndex] ?? LOCAL_FALLBACK_TRACK;

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Garante uma instância única e persistente de <audio> (essencial para iOS Safari / Chrome Android)
  const getAudioElement = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.loop = false;
      audio.volume = volumeRef.current;
      audio.muted = isMutedRef.current;
      // Compatibilidade explícita para reprodução inline no iOS Safari
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

  // Pré-aquece ObjectURLs das faixas já cacheadas para disparo síncrono dentro do clique (0ms)
  const warmCachedObjectUrls = useCallback(async (trackList: CuratedTrack[]) => {
    for (const track of trackList) {
      if (track.source === 'local' || track.audioUrl === LOCAL_FALLBACK_AUDIO_URL) continue;
      if (objectUrlCacheRef.current.has(track.id)) continue;

      const offlineUrl = await getOfflineTrackObjectUrl(track);
      if (offlineUrl && offlineUrl.startsWith('blob:')) {
        objectUrlCacheRef.current.set(track.id, offlineUrl);
      }
    }
  }, []);

  const markCachedStatus = useCallback(async (list: CuratedTrack[]): Promise<CuratedTrack[]> => {
    const enriched = await Promise.all(
      list.map(async (track) => {
        const cached = await isTrackCachedOffline(track);
        return { ...track, isCached: cached };
      })
    );
    return enriched;
  }, []);

  const saveTrackOffline = useCallback(
    async (track: CuratedTrack): Promise<boolean> => {
      if (track.source === 'local' || track.audioUrl === LOCAL_FALLBACK_AUDIO_URL) {
        return true;
      }

      if (!navigator.onLine) {
        setAudioError('Sem conexão para baixar agora. As faixas já salvas continuam disponíveis.');
        return false;
      }

      setDownloadingTrackId(track.id);
      setAudioError(null);

      try {
        const result = await cacheTrackOffline(track, token);
        if (result.ok) {
          const blobUrl = await getOfflineTrackObjectUrl(track);
          if (blobUrl && blobUrl.startsWith('blob:')) {
            objectUrlCacheRef.current.set(track.id, blobUrl);
          }

          setTracks((prev) =>
            prev.map((item) =>
              item.id === track.id
                ? {
                    ...item,
                    isCached: true,
                    sizeBytes: result.sizeBytes,
                    cachedAt: new Date().toISOString(),
                  }
                : item
            )
          );

          if (currentTrackRef.current.id === track.id) {
            setPlaybackStatus('offline');
          }

          await refreshCacheStats();
          return true;
        }

        setAudioError('Não foi possível salvar esta faixa offline no momento.');
        return false;
      } finally {
        setDownloadingTrackId(null);
      }
    },
    [refreshCacheStats, token]
  );

  // Carrega faixas do cache local (IndexedDB) e atualiza online com Jamendo
  const refreshTracks = useCallback(async () => {
    setIsLoadingTracks(true);
    setPlaybackStatus((prev) => (prev === 'idle' ? 'loading' : prev));
    setAudioError(null);

    try {
      const saved = await loadSavedTracksMetadata();
      if (saved.length > 0) {
        const enrichedSaved = await markCachedStatus(saved);
        setTracks(enrichedSaved);
        void warmCachedObjectUrls(enrichedSaved);
      }

      if (navigator.onLine && isAuthenticated) {
        const incoming = await fetchCuratedRelaxingTracks(token);
        if (incoming.length > 0) {
          const enrichedIncoming = await markCachedStatus(incoming);
          setTracks(enrichedIncoming);
          setActiveSearchQuery('');
          await saveTracksMetadata(enrichedIncoming);
          void warmCachedObjectUrls(enrichedIncoming);

          // Pré-baixa silenciosamente as 2 primeiras faixas do Jamendo para uso offline no celular
          const toAutoCache = enrichedIncoming
            .filter((t) => !t.isCached && t.source === 'jamendo')
            .slice(0, 2);

          if (toAutoCache.length > 0) {
            void Promise.allSettled(
              toAutoCache.map((t) => cacheTrackOffline(t, token))
            ).then(async () => {
              const updatedList = await markCachedStatus(enrichedIncoming);
              setTracks(updatedList);
              await saveTracksMetadata(updatedList);
              await warmCachedObjectUrls(updatedList);
              await refreshCacheStats();
            });
          }
        }
      }
    } catch {
      // Preserva faixas em cache ou fallback local
    } finally {
      setIsLoadingTracks(false);
      await refreshCacheStats();
      setPlaybackStatus((prev) => (prev === 'loading' ? 'idle' : prev));
    }
  }, [isAuthenticated, markCachedStatus, refreshCacheStats, token, warmCachedObjectUrls]);

  // Pesquisa novas faixas relaxantes na API do Jamendo (ex: "chuva", "piano", "meditação", "natureza")
  const searchTracks = useCallback(
    async (query: string) => {
      const cleaned = query.trim();
      setActiveSearchQuery(cleaned);
      setAudioError(null);

      if (!navigator.onLine) {
        setAudioError(
          'Você está offline. Exibindo suas músicas já salvas localmente no dispositivo.'
        );
        return;
      }

      setIsLoadingTracks(true);
      setPlaybackStatus('loading');

      try {
        const results = await searchRelaxingTracks(cleaned, token);
        if (results.length > 0) {
          const enriched = await markCachedStatus(results);
          setTracks(enriched);
          setCurrentIndex(0);
          await saveTracksMetadata(enriched);
          void warmCachedObjectUrls(enriched);
        } else {
          setAudioError('Nenhuma faixa encontrada para esse termo. Tente "piano", "chuva" ou "meditação".');
        }
      } catch {
        setAudioError('Erro ao buscar músicas no Jamendo. Tente novamente.');
      } finally {
        setIsLoadingTracks(false);
        setPlaybackStatus((prev) => (prev === 'loading' ? 'idle' : prev));
      }
    },
    [markCachedStatus, token, warmCachedObjectUrls]
  );

  /**
   * Reproduz uma faixa diretamente no evento de clique/toque do usuário (política de autoplay mobile).
   * Ordem de prioridade:
   * 1) ObjectURL local já aquecido do Cache API / IndexedDB -> reprodução 100% offline (0ms);
   * 2) Cache API / IndexedDB sob demanda -> Blob local;
   * 3) Online: streaming via proxy CORS-safe do backend (/bot/audio-proxy) + auto-cache em segundo plano;
   * 4) Fallback de rede: URL direta do Jamendo -> áudio acolhedor local (/audio/fallback-calm.wav).
   */
  const playTrack = useCallback(
    async (explicitTrack?: CuratedTrack) => {
      const targetTrack = explicitTrack ?? currentTrackRef.current ?? LOCAL_FALLBACK_TRACK;
      if (explicitTrack) {
        const foundIdx = tracks.findIndex((t) => t.id === explicitTrack.id);
        if (foundIdx >= 0) {
          setCurrentIndex(foundIdx);
        }
      }

      setAudioError(null);
      setIsBuffering(true);

      const audio = getAudioElement();
      audio.volume = volumeRef.current;
      audio.muted = isMutedRef.current;

      const playWithSrc = async (
        src: string,
        status: PlaybackSourceStatus,
        loopTrack = false
      ): Promise<boolean> => {
        try {
          audio.pause();
          audio.src = src;
          audio.loop = loopTrack;
          audio.load();
          setPlaybackStatus(status);
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
          setIsPlaying(true);
          setIsBuffering(false);
          return true;
        } catch {
          return false;
        }
      };

      // 1. Verifica ObjectURL pré-aquecido em memória (disparo síncrono, ideal para Safari iOS)
      const prewarmedUrl = objectUrlCacheRef.current.get(targetTrack.id);
      if (prewarmedUrl) {
        const ok = await playWithSrc(prewarmedUrl, 'offline', targetTrack.source === 'local');
        if (ok) return;
      }

      // 2. Verifica se é áudio local embutido
      if (targetTrack.source === 'local' || targetTrack.audioUrl === LOCAL_FALLBACK_AUDIO_URL) {
        const ok = await playWithSrc(LOCAL_FALLBACK_AUDIO_URL, 'offline', true);
        if (ok) return;
      }

      // 3. Verifica Cache API / IndexedDB antes de qualquer requisição de rede
      const cachedBlobUrl = await getOfflineTrackObjectUrl(targetTrack);
      if (cachedBlobUrl) {
        if (cachedBlobUrl.startsWith('blob:')) {
          objectUrlCacheRef.current.set(targetTrack.id, cachedBlobUrl);
        }
        const ok = await playWithSrc(cachedBlobUrl, 'offline', false);
        if (ok) return;
      }

      // 4. Se está offline e a faixa não estava no cache, reproduz áudio local de emergência
      if (!navigator.onLine) {
        setAudioError(
          'Esta faixa não foi baixada para uso offline. Tocando a melodia local de emergência.'
        );
        const ok = await playWithSrc(LOCAL_FALLBACK_AUDIO_URL, 'offline', true);
        if (!ok) {
          setIsBuffering(false);
          setIsPlaying(false);
        }
        return;
      }

      // 5. Online: streaming via proxy do backend (evita CORS) -> fallback URL direta do Jamendo
      const streamCandidates = [
        buildBackendAudioProxyUrl(targetTrack.audioUrl, token),
        targetTrack.audioUrl,
      ].filter((u, idx, arr) => Boolean(u) && arr.indexOf(u) === idx);

      for (const streamUrl of streamCandidates) {
        const ok = await playWithSrc(streamUrl, 'online', false);
        if (ok) {
          // Salva silenciosamente no cache offline do celular ao tocar online
          if (!targetTrack.isCached && targetTrack.source === 'jamendo') {
            void saveTrackOffline(targetTrack);
          }
          return;
        }
      }

      // 6. Rede de segurança final: áudio local garantido (/audio/fallback-calm.wav)
      const fallbackOk = await playWithSrc(LOCAL_FALLBACK_AUDIO_URL, 'offline', true);
      if (fallbackOk) {
        setAudioError(
          'Streaming externo indisponível no momento. Reproduzindo melodia local acolhedora.'
        );
        return;
      }

      setIsBuffering(false);
      setIsPlaying(false);
      setPlaybackStatus('idle');
      setAudioError(
        'O navegador bloqueou o início automático do som. Toque no botão Play para iniciar a música.'
      );
    },
    [getAudioElement, saveTrackOffline, token, tracks]
  );

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    setIsPlaying(false);
    setIsBuffering(false);
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
  }, []);

  const togglePlayPause = useCallback(async () => {
    const audio = getAudioElement();
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // Se já existe uma fonte carregada e pronta no <audio>, retoma sincronamente no clique
    if (audio.src && audio.readyState >= 2) {
      try {
        await audio.play();
        setIsPlaying(true);
        setAudioError(null);
        return;
      } catch {
        // Recarrega via playTrack
      }
    }

    await playTrack(currentTrackRef.current);
  }, [getAudioElement, isPlaying, playTrack]);

  const nextTrack = useCallback(async () => {
    if (tracks.length === 0) {
      await playTrack(LOCAL_FALLBACK_TRACK);
      return;
    }
    const nextIdx = (currentIndex + 1) % tracks.length;
    setCurrentIndex(nextIdx);
    await playTrack(tracks[nextIdx]);
  }, [currentIndex, playTrack, tracks]);

  const previousTrack = useCallback(async () => {
    if (tracks.length === 0) {
      await playTrack(LOCAL_FALLBACK_TRACK);
      return;
    }
    const prevIdx = (currentIndex - 1 + tracks.length) % tracks.length;
    setCurrentIndex(prevIdx);
    await playTrack(tracks[prevIdx]);
  }, [currentIndex, playTrack, tracks]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
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
    }
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      audioRef.current.muted = isMutedRef.current;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
  }, []);

  const clearCache = useCallback(async () => {
    await clearOfflineAudioCache();
    for (const url of objectUrlCacheRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    objectUrlCacheRef.current.clear();

    setTracks((prev) =>
      prev.map((track) => ({
        ...track,
        isCached: track.source === 'local',
        sizeBytes: undefined,
        cachedAt: undefined,
      }))
    );

    if (playbackStatus === 'offline' && currentTrackRef.current.source !== 'local') {
      setPlaybackStatus(navigator.onLine ? 'online' : 'idle');
    }

    await refreshCacheStats();
  }, [playbackStatus, refreshCacheStats]);

  // Liga os eventos nativos do elemento <audio> (progresso, duração, fim de faixa)
  useEffect(() => {
    const audio = getAudioElement();

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else {
        setDuration(currentTrackRef.current.duration || 0);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (tracks.length > 1) {
        void nextTrack();
      } else {
        audio.currentTime = 0;
        void audio.play().catch(() => setIsPlaying(false));
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [getAudioElement, nextTrack, tracks.length]);

  // Monitora conectividade e sincroniza faixas quando autenticado
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isAuthenticated) {
        void refreshTracks();
      }
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

  // Cleanup ao desmontar o app
  useEffect(() => {
    const urlsMap = objectUrlCacheRef.current;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      for (const url of urlsMap.values()) {
        URL.revokeObjectURL(url);
      }
      urlsMap.clear();
    };
  }, []);

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
