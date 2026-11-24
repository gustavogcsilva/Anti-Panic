import type { CuratedTrack } from '../types';
import { AUTH_TOKEN_STORAGE_KEY } from './api';
import {
  LOCAL_FALLBACK_AUDIO_URL,
  buildBackendAudioProxyUrl,
} from './jamendoService';

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
  // Chave estável baseada no ID da faixa para evitar inconsistências de query strings temporárias
  return `${window.location.origin}/__offline_audio__/${encodeURIComponent(track.id)}.mp3`;
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

/**
 * Carrega metadados das músicas salvas (IndexedDB com fallback automático para localStorage).
 */
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

    if (list.length > 0) {
      return list;
    }
  } catch {
    // Usa localStorage como fallback
  }

  return readLocalStorageFallback();
}

/**
 * Salva/atualiza a lista de metadados das músicas no IndexedDB e no localStorage.
 */
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

/**
 * Verifica se o arquivo de áudio de uma faixa já está disponível offline (Cache API ou IndexedDB).
 */
export async function isTrackCachedOffline(track: CuratedTrack): Promise<boolean> {
  if (track.audioUrl === LOCAL_FALLBACK_AUDIO_URL || track.source === 'local') {
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

/**
 * Recupera um Blob local do Cache API ou IndexedDB e cria uma URL local (blob:)
 * para reprodução 100% offline com suporte completo a seeking no iOS Safari e Chrome Android.
 */
export async function getOfflineTrackObjectUrl(track: CuratedTrack): Promise<string | null> {
  if (track.audioUrl === LOCAL_FALLBACK_AUDIO_URL || track.source === 'local') {
    return LOCAL_FALLBACK_AUDIO_URL;
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

/**
 * Faz o download do arquivo MP3 de forma resiliente a CORS:
 * 1) Tenta via proxy autenticado do backend (/bot/audio-proxy) — CORS garantido em todos os browsers;
 * 2) Caso não haja token ou falhe, tenta download direto da URL de audiodownload/audio do Jamendo.
 */
async function downloadAudioBlob(
  track: CuratedTrack,
  tokenOverride?: string | null
): Promise<Blob | null> {
  const sourceUrl = track.downloadUrl || track.audioUrl;
  if (!sourceUrl) return null;

  if (sourceUrl.startsWith('/')) {
    const res = await fetch(sourceUrl);
    return res.ok ? await res.blob() : null;
  }

  const token = tokenOverride ?? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const candidateUrls: Array<{ url: string; headers?: Record<string, string> }> = [];

  if (token) {
    candidateUrls.push({
      url: buildBackendAudioProxyUrl(sourceUrl, token),
      headers: { Authorization: `Bearer ${token}` },
    });
    if (track.audioUrl && track.audioUrl !== sourceUrl) {
      candidateUrls.push({
        url: buildBackendAudioProxyUrl(track.audioUrl, token),
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  // Fallback direto com CORS
  candidateUrls.push({ url: sourceUrl });
  if (track.audioUrl && track.audioUrl !== sourceUrl) {
    candidateUrls.push({ url: track.audioUrl });
  }

  for (const candidate of candidateUrls) {
    try {
      const res = await fetch(candidate.url, {
        method: 'GET',
        mode: 'cors',
        headers: candidate.headers,
      });

      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        continue;
      }

      const blob = await res.blob();
      if (blob && blob.size > 1024) {
        return blob;
      }
    } catch {
      // Tenta o próximo candidato
    }
  }

  return null;
}

/**
 * Baixa e salva a música offline na Cache API ('anti-panic-audio-v1') + fallback IndexedDB,
 * atualizando os metadados da faixa.
 */
export async function cacheTrackOffline(
  track: CuratedTrack,
  tokenOverride?: string | null
): Promise<{ ok: boolean; sizeBytes: number }> {
  if (track.audioUrl === LOCAL_FALLBACK_AUDIO_URL || track.source === 'local') {
    return { ok: true, sizeBytes: 0 };
  }

  if (!navigator.onLine) {
    const already = await isTrackCachedOffline(track);
    return { ok: already, sizeBytes: track.sizeBytes ?? 0 };
  }

  const cacheKey = getCacheKeyForTrack(track);
  const blob = await downloadAudioBlob(track, tokenOverride);
  if (!blob) {
    return { ok: false, sizeBytes: 0 };
  }

  let stored = false;

  if ('caches' in window) {
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const responseToCache = new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': blob.type || 'audio/mpeg',
          'Content-Length': String(blob.size),
        },
      });
      await cache.put(cacheKey, responseToCache);
      stored = true;
    } catch {
      // Cai para IndexedDB
    }
  }

  if (!stored) {
    try {
      await saveBlobInIndexedDb(cacheKey, blob);
      stored = true;
    } catch {
      return { ok: false, sizeBytes: 0 };
    }
  }

  // Atualiza metadados persistidos
  const existingMeta = await loadSavedTracksMetadata();
  const updatedTrack: CuratedTrack = {
    ...track,
    isCached: true,
    cachedAt: new Date().toISOString(),
    sizeBytes: blob.size,
  };
  const nextMeta = [
    updatedTrack,
    ...existingMeta.filter((item) => item.id !== track.id),
  ].slice(0, 30);

  await saveTracksMetadata(nextMeta);

  return { ok: true, sizeBytes: blob.size };
}

/**
 * Retorna a contagem de músicas baixadas offline e o espaço aproximado ocupado em bytes.
 */
export async function getOfflineCacheStats(): Promise<OfflineCacheStats> {
  let cachedCount = 0;
  let totalSizeBytes = 0;

  if ('caches' in window) {
    try {
      const cache = await caches.open(AUDIO_CACHE_NAME);
      const keys = await cache.keys();
      for (const req of keys) {
        const res = await cache.match(req);
        if (!res) continue;
        cachedCount += 1;
        const headerLen = Number(res.headers.get('content-length') || 0);
        if (headerLen > 0) {
          totalSizeBytes += headerLen;
        } else {
          const blob = await res.blob();
          totalSizeBytes += blob.size;
        }
      }
    } catch {
      // Ignora
    }
  }

  if (cachedCount === 0) {
    try {
      const db = await openMusicDb();
      const blobs = await new Promise<StoredBlobEntry[]>((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, 'readonly');
        const req = tx.objectStore(STORE_BLOBS).getAll();
        req.onsuccess = () => resolve((req.result as StoredBlobEntry[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      db.close();
      cachedCount = blobs.length;
      totalSizeBytes = blobs.reduce((sum, item) => sum + (item.sizeBytes || 0), 0);
    } catch {
      // Ignora
    }
  }

  return { cachedCount, totalSizeBytes };
}

/**
 * Limpa todos os arquivos de áudio salvos offline para liberar espaço no celular.
 */
export async function clearOfflineAudioCache(): Promise<void> {
  if ('caches' in window) {
    try {
      await caches.delete(AUDIO_CACHE_NAME);
      // Remove também cache legado se existir
      await caches.delete('calm-panic-audio-v1');
    } catch {
      // Ignora
    }
  }

  try {
    const db = await openMusicDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_BLOBS, STORE_META], 'readwrite');
      tx.objectStore(STORE_BLOBS).clear();
      const metaStore = tx.objectStore(STORE_META);
      const req = metaStore.getAll();
      req.onsuccess = () => {
        const tracks = (req.result as CuratedTrack[]) ?? [];
        for (const t of tracks) {
          metaStore.put({ ...t, isCached: false, sizeBytes: undefined, cachedAt: undefined });
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignora
  }

  const localTracks = readLocalStorageFallback().map((t) => ({
    ...t,
    isCached: false,
    sizeBytes: undefined,
    cachedAt: undefined,
  }));
  writeLocalStorageFallback(localTracks);
}
