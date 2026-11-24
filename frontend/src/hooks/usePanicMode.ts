import { useCallback, useEffect, useRef, useState } from 'react';
import { useMusicPlayer } from '../contexts/MusicPlayerContext';
import type { CuratedTrack } from '../types';

export type { CuratedTrack };

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

const PENDING_LOGS_STORAGE_KEY = 'calm_pending_panic_logs_v1';
const DEFAULT_VIBRATION_PATTERN = [4000, 4000];

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
    // Ignora falhas de quota
  }
}

export function usePanicMode({
  apiBaseUrl,
  authToken,
  vibrationPattern = DEFAULT_VIBRATION_PATTERN,
}: UsePanicModeOptions): UsePanicModeReturn {
  const {
    currentTrack,
    isLoadingTracks,
    isOnline,
    cacheStats,
    audioError,
    playTrack,
    stop,
    nextTrack,
    refreshTracks,
  } = useMusicPlayer();

  const [isCrisisActive, setIsCrisisActive] = useState(false);

  const vibrationIntervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

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

  const requestScreenWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && navigator.wakeLock) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Falha silenciosa
    }
  }, []);

  const releaseScreenWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

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

  // Ativa o Modo Crise imediatamente (dispara áudio no gesto do usuário + vibração + Wake Lock)
  const activatePanicMode = useCallback(async () => {
    setIsCrisisActive(true);
    startCalmingVibration();
    void requestScreenWakeLock();
    await playTrack(currentTrack);
    void logPanicEvent(currentTrack);
  }, [currentTrack, logPanicEvent, playTrack, requestScreenWakeLock, startCalmingVibration]);

  const deactivatePanicMode = useCallback(() => {
    setIsCrisisActive(false);
    stopCalmingVibration();
    releaseScreenWakeLock();
    stop();
  }, [releaseScreenWakeLock, stop, stopCalmingVibration]);

  useEffect(() => {
    const handleOnline = () => {
      void flushPendingLogs();
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      void flushPendingLogs();
    }
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [flushPendingLogs]);

  useEffect(() => {
    return () => {
      stopCalmingVibration();
      releaseScreenWakeLock();
    };
  }, [releaseScreenWakeLock, stopCalmingVibration]);

  return {
    isCrisisActive,
    isSyncingAudio: isLoadingTracks,
    isOfflineReady: cacheStats.cachedCount > 0,
    isOnline,
    cachedTracksCount: cacheStats.cachedCount,
    currentTrack,
    audioError,
    activatePanicMode,
    deactivatePanicMode,
    switchTrack: nextTrack,
    syncOfflineTracks: refreshTracks,
  };
}
