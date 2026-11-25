import type { CuratedTrack } from '../types';
import { fetchCuratedRelaxingTracks } from './relaxingAudioService';
import {
  AUDIO_CACHE_NAME,
  TRACKS_META_STORAGE_KEY,
  saveTracksMetadata,
} from './musicOfflineCache';

export { AUDIO_CACHE_NAME, TRACKS_META_STORAGE_KEY };

/**
 * Sincroniza o catálogo de sons relaxantes (Web Audio API + áudios locais precacheados)
 * no IndexedDB para disponibilidade imediata offline.
 */
export async function prefetchOfflineTracks(
  tokenOverride?: string | null
): Promise<CuratedTrack[]> {
  try {
    const tracks = await fetchCuratedRelaxingTracks(tokenOverride);
    if (tracks.length > 0) {
      await saveTracksMetadata(tracks);
    }
    return tracks;
  } catch {
    return [];
  }
}
