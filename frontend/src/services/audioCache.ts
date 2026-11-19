import type { CuratedTrack } from '../types';
import { API_BASE_URL, AUTH_TOKEN_STORAGE_KEY } from './api';

export const AUDIO_CACHE_NAME = 'calm-panic-audio-v1';
export const TRACKS_META_STORAGE_KEY = 'calm_cached_tracks_v1';

/**
 * Busca 5 faixas personalizadas em GET /bot/tracks e armazena os arquivos MP3
 * no Cache Storage do navegador para reprodução imediata offline.
 */
export async function prefetchOfflineTracks(tokenOverride?: string | null): Promise<CuratedTrack[]> {
  if (!navigator.onLine || !('caches' in window)) {
    return [];
  }

  const token = tokenOverride ?? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) return [];

  try {
    const response = await fetch(`${API_BASE_URL}/bot/tracks`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { tracks?: CuratedTrack[] };
    const incomingTracks = Array.isArray(data.tracks) ? data.tracks : [];
    if (incomingTracks.length === 0) return [];

    const cache = await caches.open(AUDIO_CACHE_NAME);
    const cachedList: CuratedTrack[] = [];

    await Promise.allSettled(
      incomingTracks.map(async (track) => {
        const existing = await cache.match(track.audioUrl);
        if (existing) {
          cachedList.push(track);
          return;
        }

        const audioResponse = await fetch(track.audioUrl, { mode: 'cors' });
        if (audioResponse.ok) {
          await cache.put(track.audioUrl, audioResponse.clone());
          cachedList.push(track);
        }
      })
    );

    if (cachedList.length > 0) {
      const keepUrls = new Set(cachedList.map((track) => track.audioUrl));
      const existingRequests = await cache.keys();
      await Promise.all(
        existingRequests
          .filter((req) => !keepUrls.has(req.url))
          .map((req) => cache.delete(req))
      );

      try {
        window.localStorage.setItem(TRACKS_META_STORAGE_KEY, JSON.stringify(cachedList));
      } catch {
        // Ignora erro de quota
      }
    }

    return cachedList;
  } catch {
    return [];
  }
}
