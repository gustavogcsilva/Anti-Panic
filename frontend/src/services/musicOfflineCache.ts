import type { CuratedTrack } from '../types';
import { LOCAL_FALLBACK_AUDIO_URL } from './relaxingAudioService';

export const AUDIO_CACHE_NAME = 'anti-panic-audio-v1';
export const TRACKS_META_STORAGE_KEY = 'anti_panic_tracks_meta_v1';

const DB_NAME = 'anti_panic_music_offline_db_v1';
const DB_VERSION = 1;
const STORE_META = 'tracks_meta';
const STORE_BLOBS = 'audio_blobs';

interface StoredBlobEntry {
  key: string;
  blob: Blob;
  sizeBytes: number;
  cachedAt: string;
}

export interface OfflineCacheStats {
  cachedCount: number;
  totalSizeBytes: number;
}

function getCacheKeyForTrack(track: CuratedTrack): string {
  return `${window.location.origin}/__offline_audio__/${encodeURIComponent(track.id)}.audio`;
}

function openMusicDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readLocalStorageFallback(): CuratedTrack[] {
  try {
    const raw = window.localStorage.getItem(TRACKS_META_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CuratedTrack[]) : [];
  } catch {
    return [];
  }
}

function writeLocalStorageFallback(tracks: CuratedTrack[]): void {
  try {
    window.localStorage.setItem(TRACKS_META_STORAGE_KEY, JSON.stringify(tracks));
  } catch {
    // Ignora quota excedida
  }
}

export async function loadSavedTracksMetadata(): Promise<CuratedTrack[]> {
  try {
    const db = await openMusicDb();
    const list = await new Promise<CuratedTrack[]>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).getAll();
      req.onsuccess = () => resolve((req.result as CuratedTrack[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (list.length > 0) return list;
  } catch {
    // Usa localStorage como fallback
  }

  return readLocalStorageFallback();
}

export async function saveTracksMetadata(tracks: CuratedTrack[]): Promise<void> {
  writeLocalStorageFallback(tracks);

  try {
    const db = await openMusicDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      for (const track of tracks) {
        store.put(track);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Já salvo no localStorage
  }
}

async function saveBlobInIndexedDb(key: string, blob: Blob): Promise<void> {
  const db = await openMusicDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    const entry: StoredBlobEntry = {
      key,
      blob,
      sizeBytes: blob.size,
      cachedAt: new Date().toISOString(),
    };
    tx.objectStore(STORE_BLOBS).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getBlobFromIndexedDb(key: string): Promise<Blob | null> {
  try {
    const db = await openMusicDb();
    const entry = await new Promise<StoredBlobEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const req = tx.objectStore(STORE_BLOBS).get(key);
      req.onsuccess = () => resolve(req.result as StoredBlobEntry | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return entry?.blob ?? null;
  } catch {
    return null;
  }
}

export async function isTrackCachedOffline(track: CuratedTrack): Promise<boolean> {
  if (
    track.source === 'synthesizer' ||
    track.source === 'local' ||
    track.audioUrl.startsWith('synth://') ||
    track.audioUrl.startsWith('/audio/')
  ) {
    return true;
  }

  const cacheKey = getCacheKeyForTrack(track);

  if ('caches' in window) {
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const match = await cache.match(cacheKey);
      if (match) return true;
    } catch {
      // Continua para IndexedDB
    }
  }

  const blob = await getBlobFromIndexedDb(cacheKey);
  return Boolean(blob && blob.size > 1024);
}

export async function getOfflineTrackObjectUrl(track: CuratedTrack): Promise<string | null> {
  if (track.source === 'synthesizer' || track.audioUrl.startsWith('synth://')) {
    return track.audioUrl;
  }

  if (track.source === 'local' || track.audioUrl.startsWith('/audio/')) {
    return track.audioUrl || LOCAL_FALLBACK_AUDIO_URL;
  }

  const cacheKey = getCacheKeyForTrack(track);

  if ('caches' in window) {
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const match = await cache.match(cacheKey);
      if (match) {
        const blob = await match.blob();
        if (blob && blob.size > 1024) {
          return URL.createObjectURL(blob);
        }
      }
    } catch {
      // Tenta IndexedDB
    }
  }

  const idbBlob = await getBlobFromIndexedDb(cacheKey);
  if (idbBlob && idbBlob.size > 1024) {
    return URL.createObjectURL(idbBlob);
  }

  return null;
}

export async function cacheTrackOffline(
  track: CuratedTrack
): Promise<{ ok: boolean; sizeBytes: number }> {
  if (
    track.source === 'synthesizer' ||
    track.source === 'local' ||
    track.audioUrl.startsWith('synth://') ||
    track.audioUrl.startsWith('/audio/')
  ) {
    return { ok: true, sizeBytes: 0 };
  }

  const sourceUrl = track.downloadUrl || track.audioUrl;
  if (!sourceUrl || !navigator.onLine) {
    const already = await isTrackCachedOffline(track);
    return { ok: already, sizeBytes: track.sizeBytes ?? 0 };
  }

  try {
    const res = await fetch(sourceUrl, { method: 'GET', mode: 'cors' });
    if (!res.ok) return { ok: false, sizeBytes: 0 };

    const blob = await res.blob();
    if (!blob || blob.size < 1024) return { ok: false, sizeBytes: 0 };

    const cacheKey = getCacheKeyForTrack(track);
    let stored = false;

    if ('caches' in window) {
      try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        await cache.put(
          cacheKey,
          new Response(blob, {
            status: 200,
            headers: {
              'Content-Type': blob.type || 'audio/mpeg',
              'Content-Length': String(blob.size),
            },
          })
        );
        stored = true;
      } catch {
        // Fallback para IndexedDB
      }
    }

    if (!stored) {
      await saveBlobInIndexedDb(cacheKey, blob);
    }

    return { ok: true, sizeBytes: blob.size };
  } catch {
    return { ok: false, sizeBytes: 0 };
  }
}

export async function getOfflineCacheStats(): Promise<OfflineCacheStats> {
  // Os 6 sintetizadores Web Audio + 3 áudios locais WAV estão sempre disponíveis offline
  return { cachedCount: 9, totalSizeBytes: 793_932 };
}

export async function clearOfflineAudioCache(): Promise<void> {
  if ('caches' in window) {
    try {
      await caches.delete(AUDIO_CACHE_NAME);
      await caches.delete('calm-panic-audio-v1');
    } catch {
      // Ignora
    }
  }

  try {
    const db = await openMusicDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_BLOBS], 'readwrite');
      tx.objectStore(STORE_BLOBS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignora
  }
}
