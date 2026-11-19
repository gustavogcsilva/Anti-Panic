import { useCallback, useEffect, useRef, useState } from 'react';

export interface CuratedTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  duration: number;
  coverUrl: string | null;
  genre: string;
  moodTag: 'happy' | 'uplifting' | 'calming' | 'relaxing';
}

interface PendingPanicLog {
  triggeredAt: string;
  trackId: string | null;
  trackTitle: string;
  trackArtist: string | null;
  trackUrl: string | null;
  wasOffline: boolean;
}

export interface UsePanicModeOptions {
  /** Base URL da API backend (ex: import.meta.env.VITE_API_URL) */
  apiBaseUrl: string;
  /** Token JWT do usuário autenticado */
  authToken: string | null;
  /** Padrão de vibração em ms: [vibra, pausa]. Padrão calmante: 4s / 4s */
  vibrationPattern?: number[];
  /** MP3 local precacheado pelo Service Worker como rede de segurança extrema */
  localFallbackAudioUrl?: string;
}

export interface UsePanicModeReturn {
  isCrisisActive: boolean;
  isSyncingAudio: boolean;
  isOfflineReady: boolean;
  isOnline: boolean;
  cachedTracksCount: number;
  currentTrack: CuratedTrack | null;
  audioError: string | null;
  activatePanicMode: () => Promise<void>;
  deactivatePanicMode: () => void;
  switchTrack: () => Promise<void>;
  syncOfflineTracks: () => Promise<void>;
}

const AUDIO_CACHE_NAME = 'calm-panic-audio-v1';
const TRACKS_META_STORAGE_KEY = 'calm_cached_tracks_v1';
const PENDING_LOGS_STORAGE_KEY = 'calm_pending_panic_logs_v1';
const DEFAULT_VIBRATION_PATTERN = [4000, 4000];
const DEFAULT_FALLBACK_AUDIO = '/audio/fallback-calm.mp3';

const FALLBACK_TRACK: CuratedTrack = {
  id: 'local-fallback',
  title: 'Melodia Acolhedora (Offline)',
  artist: 'Apoio Local',
  audioUrl: DEFAULT_FALLBACK_AUDIO,
  duration: 180,
  coverUrl: null,
  genre: 'ambient',
  moodTag: 'uplifting',
};

function readStorageJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJson<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignora falhas de quota ou modo privado para não interromper o atendimento à crise
  }
}

export function usePanicMode({
  apiBaseUrl,
  authToken,
  vibrationPattern = DEFAULT_VIBRATION_PATTERN,
  localFallbackAudioUrl = DEFAULT_FALLBACK_AUDIO,
}: UsePanicModeOptions): UsePanicModeReturn {
  const [isCrisisActive, setIsCrisisActive] = useState(false);
  const [isSyncingAudio, setIsSyncingAudio] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [cachedTracks, setCachedTracks] = useState<CuratedTrack[]>(() =>
    readStorageJson<CuratedTrack[]>(TRACKS_META_STORAGE_KEY, [])
  );
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const preloadedRef = useRef<{ trackId: string; objectUrl: string } | null>(null);
  const vibrationIntervalRef = useRef<number | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const currentTrack =
    cachedTracks.length > 0
      ? cachedTracks[currentTrackIndex % cachedTracks.length]
      : { ...FALLBACK_TRACK, audioUrl: localFallbackAudioUrl };

  const isOfflineReady = cachedTracks.length > 0;

  // Inicializa uma única instância de Audio reutilizável (essencial para políticas de autoplay mobile)
  const getAudioElement = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const revokeActiveObjectUrl = useCallback(() => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  }, []);

  const clearFadeInterval = useCallback(() => {
    if (fadeIntervalRef.current !== null) {
      window.clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }, []);

  // Fade-in suave para evitar susto auditivo durante um pico de ansiedade
  const applyGentleFadeIn = useCallback(
    (audio: HTMLAudioElement, targetVolume = 0.85, durationMs = 1500) => {
      clearFadeInterval();
      audio.volume = 0.08;
      const steps = 15;
      const stepMs = durationMs / steps;
      const volumeDelta = (targetVolume - audio.volume) / steps;

      fadeIntervalRef.current = window.setInterval(() => {
        const nextVolume = Math.min(targetVolume, audio.volume + volumeDelta);
        audio.volume = nextVolume;
        if (nextVolume >= targetVolume) {
          clearFadeInterval();
        }
      }, stepMs);
    },
    [clearFadeInterval]
  );

  // Vibração rítmica contínua em loop (navigator.vibrate executa apenas uma vez por chamada)
  const startCalmingVibration = useCallback(() => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return;
    }

    if (vibrationIntervalRef.current !== null) {
      window.clearInterval(vibrationIntervalRef.current);
    }

    const cycleDurationMs = vibrationPattern.reduce((sum, ms) => sum + ms, 0);
    navigator.vibrate(vibrationPattern);

    if (cycleDurationMs > 0) {
      vibrationIntervalRef.current = window.setInterval(() => {
        navigator.vibrate(vibrationPattern);
      }, cycleDurationMs);
    }
  }, [vibrationPattern]);

  const stopCalmingVibration = useCallback(() => {
    if (vibrationIntervalRef.current !== null) {
      window.clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(0);
    }
  }, []);

  // Mantém a tela ligada durante o guia de respiração (quando suportado pelo navegador)
  const requestScreenWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && navigator.wakeLock) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Falha silenciosa (ex: modo economia de bateria ou navegador sem suporte)
    }
  }, []);

  const releaseScreenWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Pré-aquece o ObjectURL da primeira faixa em cache para resposta instantânea (0ms)
  // e compatibilidade com políticas restritivas de autoplay no iOS Safari
  useEffect(() => {
    let cancelled = false;

    const preloadFirstTrack = async () => {
      const firstTrack = cachedTracks[0];
      if (!firstTrack || !('caches' in window)) return;

      if (preloadedRef.current?.trackId === firstTrack.id) return;

      try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const cachedResponse = await cache.match(firstTrack.audioUrl);
        if (!cachedResponse || cancelled) return;

        const blob = await cachedResponse.blob();
        if (cancelled) return;

        const objectUrl = URL.createObjectURL(blob);
        if (
          preloadedRef.current &&
          preloadedRef.current.objectUrl !== activeObjectUrlRef.current &&
          audioRef.current?.src !== preloadedRef.current.objectUrl
        ) {
          URL.revokeObjectURL(preloadedRef.current.objectUrl);
        }
        preloadedRef.current = { trackId: firstTrack.id, objectUrl };
      } catch {
        // Silencioso: resolvePlayableSource fará o fallback sob demanda
      }
    };

    void preloadFirstTrack();

    return () => {
      cancelled = true;
    };
  }, [cachedTracks]);

  // Resolve a fonte de áudio priorizando o ObjectURL pré-aquecido e depois o Cache Storage local
  const resolvePlayableSource = useCallback(
    async (track: CuratedTrack): Promise<string> => {
      if (preloadedRef.current?.trackId === track.id) {
        return preloadedRef.current.objectUrl;
      }

      if ('caches' in window) {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const cachedResponse = await cache.match(track.audioUrl);

        if (cachedResponse) {
          const blob = await cachedResponse.blob();
          revokeActiveObjectUrl();
          const objectUrl = URL.createObjectURL(blob);
          activeObjectUrlRef.current = objectUrl;
          return objectUrl;
        }
      }

      // Se online mas não estava em cache, usa URL direta; se offline, cai para MP3 local embutido
      return navigator.onLine ? track.audioUrl : localFallbackAudioUrl;
    },
    [localFallbackAudioUrl, revokeActiveObjectUrl]
  );

  const playTrack = useCallback(
    async (track: CuratedTrack) => {
      setAudioError(null);
      const audio = getAudioElement();

      try {
        // Se a faixa já estiver pré-aquecida em memória, evita await antes de audio.play()
        const playableSrc =
          preloadedRef.current?.trackId === track.id
            ? preloadedRef.current.objectUrl
            : await resolvePlayableSource(track);

        audio.pause();
        audio.src = playableSrc;
        audio.loop = true;
        audio.load();

        await audio.play();
        applyGentleFadeIn(audio);
      } catch {
        // Última rede de segurança: toca o arquivo local precacheado
        try {
          audio.pause();
          audio.src = localFallbackAudioUrl;
          audio.loop = true;
          await audio.play();
          applyGentleFadeIn(audio);
        } catch {
          setAudioError(
            'Não foi possível iniciar o áudio automaticamente. Toque em "Trocar Música" para tentar novamente.'
          );
        }
      }
    },
    [applyGentleFadeIn, getAudioElement, localFallbackAudioUrl, resolvePlayableSource]
  );

  // Envia log do acionamento para POST /logs/panic ou enfileira se offline
  const logPanicEvent = useCallback(
    async (track: CuratedTrack) => {
      const entry: PendingPanicLog = {
        triggeredAt: new Date().toISOString(),
        trackId: track.id,
        trackTitle: track.title,
        trackArtist: track.artist,
        trackUrl: track.audioUrl,
        wasOffline: !navigator.onLine,
      };

      const enqueueLog = () => {
        const pending = readStorageJson<PendingPanicLog[]>(PENDING_LOGS_STORAGE_KEY, []);
        writeStorageJson(PENDING_LOGS_STORAGE_KEY, [...pending, entry]);
      };

      if (!navigator.onLine || !authToken) {
        enqueueLog();
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/logs/panic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(entry),
        });

        if (!response.ok) {
          enqueueLog();
        }
      } catch {
        enqueueLog();
      }
    },
    [apiBaseUrl, authToken]
  );

  // Reenvia logs de crises registradas offline assim que a conexão voltar
  const flushPendingLogs = useCallback(async () => {
    if (!navigator.onLine || !authToken) return;

    const pending = readStorageJson<PendingPanicLog[]>(PENDING_LOGS_STORAGE_KEY, []);
    if (pending.length === 0) return;

    const remaining: PendingPanicLog[] = [];

    for (const log of pending) {
      try {
        const res = await fetch(`${apiBaseUrl}/logs/panic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(log),
        });

        if (!res.ok) {
          remaining.push(log);
        }
      } catch {
        remaining.push(log);
      }
    }

    writeStorageJson(PENDING_LOGS_STORAGE_KEY, remaining);
  }, [apiBaseUrl, authToken]);

  // Busca as 5 faixas alegres do Bot Curador e baixa os MP3s para o Cache Storage em segundo plano
  const syncOfflineTracks = useCallback(async () => {
    if (!navigator.onLine || !authToken || !('caches' in window)) {
      return;
    }

    setIsSyncingAudio(true);

    try {
      const response = await fetch(`${apiBaseUrl}/bot/tracks`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) return;

      const data = (await response.json()) as { tracks: CuratedTrack[] };
      const incomingTracks = Array.isArray(data.tracks) ? data.tracks : [];
      if (incomingTracks.length === 0) return;

      const cache = await caches.open(AUDIO_CACHE_NAME);
      const successfullyCached: CuratedTrack[] = [];

      await Promise.allSettled(
        incomingTracks.map(async (track) => {
          const existing = await cache.match(track.audioUrl);
          if (existing) {
            successfullyCached.push(track);
            return;
          }

          const audioRes = await fetch(track.audioUrl, { mode: 'cors' });
          if (audioRes.ok) {
            await cache.put(track.audioUrl, audioRes.clone());
            successfullyCached.push(track);
          }
        })
      );

      if (successfullyCached.length > 0) {
        // Limpa MP3s antigos que não fazem mais parte da seleção atual para economizar espaço
        const keepUrls = new Set(successfullyCached.map((t) => t.audioUrl));
        const cachedRequests = await cache.keys();
        await Promise.all(
          cachedRequests
            .filter((req) => !keepUrls.has(req.url))
            .map((req) => cache.delete(req))
        );

        setCachedTracks(successfullyCached);
        writeStorageJson(TRACKS_META_STORAGE_KEY, successfullyCached);
      }
    } catch {
      // Silencioso: preserva as faixas já cacheadas anteriormente
    } finally {
      setIsSyncingAudio(false);
    }
  }, [apiBaseUrl, authToken]);

  // Ativa o Modo Crise imediatamente (áudio + vibração + Wake Lock + registro de log)
  const activatePanicMode = useCallback(async () => {
    // Prioriza a faixa 0 (já embaralhada pelo Bot Curador e pré-aquecida em memória)
    // garantindo disparo síncrono de audio.play() no gesto do usuário (iOS/Android)
    const startIndex = 0;
    const selectedTrack =
      cachedTracks[startIndex] ?? {
        ...FALLBACK_TRACK,
        audioUrl: localFallbackAudioUrl,
      };

    setCurrentTrackIndex(startIndex);
    setIsCrisisActive(true);

    startCalmingVibration();
    void requestScreenWakeLock();
    await playTrack(selectedTrack);
    void logPanicEvent(selectedTrack);
  }, [
    cachedTracks,
    localFallbackAudioUrl,
    logPanicEvent,
    playTrack,
    requestScreenWakeLock,
    startCalmingVibration,
  ]);

  // Encerra o Modo Crise limpando áudio, vibração e Wake Lock
  const deactivatePanicMode = useCallback(() => {
    setIsCrisisActive(false);
    setAudioError(null);
    clearFadeInterval();
    stopCalmingVibration();
    releaseScreenWakeLock();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    revokeActiveObjectUrl();
  }, [
    clearFadeInterval,
    releaseScreenWakeLock,
    revokeActiveObjectUrl,
    stopCalmingVibration,
  ]);

  // Troca para a próxima música cacheada sem sair do Modo Crise
  const switchTrack = useCallback(async () => {
    if (cachedTracks.length === 0) {
      await playTrack({ ...FALLBACK_TRACK, audioUrl: localFallbackAudioUrl });
      return;
    }

    const nextIndex = (currentTrackIndex + 1) % cachedTracks.length;
    setCurrentTrackIndex(nextIndex);
    await playTrack(cachedTracks[nextIndex]);
  }, [cachedTracks, currentTrackIndex, localFallbackAudioUrl, playTrack]);

  // Monitora conectividade para sincronizar MP3s e fila de logs offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void flushPendingLogs();
      void syncOfflineTracks();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sincronização inicial ao abrir a Home (quando online)
    if (navigator.onLine) {
      void flushPendingLogs();
      void syncOfflineTracks();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushPendingLogs, syncOfflineTracks]);

  // Cleanup geral ao desmontar o componente
  useEffect(() => {
    return () => {
      clearFadeInterval();
      stopCalmingVibration();
      releaseScreenWakeLock();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (preloadedRef.current) {
        URL.revokeObjectURL(preloadedRef.current.objectUrl);
        preloadedRef.current = null;
      }
      revokeActiveObjectUrl();
    };
  }, [
    clearFadeInterval,
    releaseScreenWakeLock,
    revokeActiveObjectUrl,
    stopCalmingVibration,
  ]);

  return {
    isCrisisActive,
    isSyncingAudio,
    isOfflineReady,
    isOnline,
    cachedTracksCount: cachedTracks.length,
    currentTrack,
    audioError,
    activatePanicMode,
    deactivatePanicMode,
    switchTrack,
    syncOfflineTracks,
  };
}
