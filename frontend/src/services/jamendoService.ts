import type { CuratedTrack } from '../types';
import { API_BASE_URL, AUTH_TOKEN_STORAGE_KEY } from './api';

export const LOCAL_FALLBACK_AUDIO_URL = '/audio/fallback-calm.wav';

export const LOCAL_FALLBACK_TRACK: CuratedTrack = {
  id: 'local-calm-fallback',
  title: 'Respiração Serena (Acorde Acolhedor)',
  artist: 'Respira Studio (Offline)',
  audioUrl: LOCAL_FALLBACK_AUDIO_URL,
  downloadUrl: LOCAL_FALLBACK_AUDIO_URL,
  audioDownloadAllowed: true,
  duration: 12,
  coverUrl: null,
  genre: 'ambient',
  moodTag: 'calming',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  source: 'local',
  isCached: true,
};

interface JamendoDirectResult {
  id: string;
  name: string;
  artist_name: string;
  duration: number;
  audio: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  image?: string;
  album_image?: string;
  license_ccurl?: string;
}

const PT_TO_EN_TAGS: Record<string, string> = {
  chuva: 'rain',
  piano: 'piano',
  meditacao: 'meditation',
  natureza: 'nature',
  floresta: 'forest',
  mar: 'ocean',
  sono: 'sleep',
  calma: 'calm',
  ambiente: 'ambient',
  relaxante: 'relaxing',
};

function translateQuery(raw: string): string {
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!normalized) return 'ambient+relaxation+meditation';
  return normalized
    .split(/\s+/)
    .map((w) => PT_TO_EN_TAGS[w] ?? w.replace(/[^a-z0-9-]/g, ''))
    .filter(Boolean)
    .join('+');
}

function getAuthToken(tokenOverride?: string | null): string | null {
  return tokenOverride ?? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

/**
 * Monta a URL do proxy de áudio do backend Express (resolve problemas de CORS do Jamendo
 * e preserva suporte a Range Requests bytes=0- para Safari iOS e Chrome Android).
 */
export function buildBackendAudioProxyUrl(
  rawAudioUrl: string,
  tokenOverride?: string | null
): string {
  if (!rawAudioUrl || rawAudioUrl.startsWith('/') || rawAudioUrl.startsWith('blob:')) {
    return rawAudioUrl;
  }

  const token = getAuthToken(tokenOverride);
  const params = new URLSearchParams({ url: rawAudioUrl });
  if (token) {
    params.set('token', token);
  }
  return `${API_BASE_URL}/bot/audio-proxy?${params.toString()}`;
}

/**
 * Fallback opcional: consulta direta à API do Jamendo caso VITE_JAMENDO_CLIENT_ID
 * seja definido diretamente no frontend (normalmente a consulta passa pelo backend).
 */
async function fetchDirectlyFromJamendo(query?: string): Promise<CuratedTrack[]> {
  const clientId = (
    import.meta.env as Record<string, string | undefined>
  ).VITE_JAMENDO_CLIENT_ID?.trim();

  if (!clientId) return [];

  const params = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '10',
    audioformat: 'mp32',
    audiodlformat: 'mp32',
    order: 'popularity_total',
    fuzzytags: query ? `${translateQuery(query)}+relaxing` : 'ambient+relaxation+meditation',
  });

  const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as { results?: JamendoDirectResult[] };
  return (payload.results ?? [])
    .filter((item) => Boolean(item.audio && item.audio.startsWith('https://')))
    .map(
      (item): CuratedTrack => ({
        id: String(item.id),
        title: item.name.trim(),
        artist: item.artist_name.trim(),
        audioUrl: item.audio.trim(),
        downloadUrl:
          item.audiodownload && item.audiodownload.startsWith('https://')
            ? item.audiodownload.trim()
            : item.audio.trim(),
        audioDownloadAllowed: Boolean(item.audiodownload_allowed ?? true),
        duration: item.duration || 180,
        coverUrl: item.image || item.album_image || null,
        genre: query || 'ambient',
        moodTag: 'relaxing',
        licenseUrl: item.license_ccurl || null,
        source: 'jamendo',
      })
    );
}

/**
 * Busca faixas relaxantes curadas para o usuário (via backend Express -> Jamendo API v3).
 */
export async function fetchCuratedRelaxingTracks(
  tokenOverride?: string | null
): Promise<CuratedTrack[]> {
  if (!navigator.onLine) {
    return [];
  }

  const token = getAuthToken(tokenOverride);

  if (token) {
    try {
      const response = await fetch(`${API_BASE_URL}/bot/tracks`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { tracks?: CuratedTrack[] };
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          return data.tracks;
        }
      }
    } catch {
      // Tenta fallback direto se VITE_JAMENDO_CLIENT_ID existir
    }
  }

  try {
    const directTracks = await fetchDirectlyFromJamendo();
    if (directTracks.length > 0) return directTracks;
  } catch {
    // Sem rede ou Jamendo indisponível
  }

  return [];
}

/**
 * Pesquisa músicas relaxantes no Jamendo por humor/termo (ex: "chuva", "piano", "meditação", "natureza").
 */
export async function searchRelaxingTracks(
  query: string,
  tokenOverride?: string | null
): Promise<CuratedTrack[]> {
  if (!navigator.onLine) {
    return [];
  }

  const cleaned = query.trim();
  const token = getAuthToken(tokenOverride);

  if (token) {
    try {
      const params = new URLSearchParams();
      if (cleaned) params.set('q', cleaned);
      params.set('limit', '10');

      const response = await fetch(`${API_BASE_URL}/bot/search?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { tracks?: CuratedTrack[] };
        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          return data.tracks;
        }
      }
    } catch {
      // Tenta fallback direto
    }
  }

  try {
    return await fetchDirectlyFromJamendo(cleaned);
  } catch {
    return [];
  }
}
