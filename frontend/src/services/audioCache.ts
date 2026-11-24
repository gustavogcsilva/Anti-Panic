import type { CuratedTrack } from '../types';
import { fetchCuratedRelaxingTracks } from './jamendoService';
import {
  AUDIO_CACHE_NAME,
  TRACKS_META_STORAGE_KEY,
  cacheTrackOffline,
  saveTracksMetadata,
} from './musicOfflineCache';

export { AUDIO_CACHE_NAME, TRACKS_META_STORAGE_KEY };

/**
 * Busca faixas personalizadas em GET /bot/tracks e armazena automaticamente
 * as primeiras faixas no Cache API ('anti-panic-audio-v1') + IndexedDB para uso offline.
 */
export async function prefetchOfflineTracks(
  tokenOverride?: string | null
): Promise<CuratedTrack[]> {
  if (!navigator.onLine) {
    return [];
  }

  try {
    const incomingTracks = await fetchCuratedRelaxingTracks(tokenOverride);
    if (incomingTracks.length === 0) return [];

    await saveTracksMetadata(incomingTracks);

    // Pré-baixa automaticamente as 3 primeiras faixas para pronta-entrega offline no celular
    const toAutoCache = incomingTracks.slice(0, 3);
    const results = await Promise.allSettled(
      toAutoCache.map((track) => cacheTrackOffline(track, tokenOverride))
    );

    const updated = incomingTracks.map((track, idx) => {
      if (idx < toAutoCache.length && results[idx]?.status === 'fulfilled' && results[idx].value.ok) {
        return {
          ...track,
          isCached: true,
          sizeBytes: results[idx].value.sizeBytes,
          cachedAt: new Date().toISOString(),
        };
      }
      return track;
    });

    await saveTracksMetadata(updated);
    return updated;
  } catch {
    return [];
  }
}
