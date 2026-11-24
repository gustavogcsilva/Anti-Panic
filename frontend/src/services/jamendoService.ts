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
  if (!normalized) return 'ambient relaxation meditation';
  return normalized
    .split(/\s+/)
    .map((w) => PT_TO_EN_TAGS[w] ?? w.replace(/[^a-z0-9-]/g, ''))
    .filter(Boolean)
    .join(' ');
}

function shuffleTracks<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
 * Consulta direta à API do Jamendo usando VITE_JAMENDO_CLIENT_ID (com offset aleatório
 * e fallback automático para offset=0), avisando no console se a variável não estiver configurada.
 */
async function fetchDirectlyFromJamendo(query?: string): Promise<CuratedTrack[]> {
  const clientId = (
    import.meta.env as Record<string, string | undefined>
  ).VITE_JAMENDO_CLIENT_ID?.trim();

  if (!clientId) {
    console.warn(
      '[JamendoService] VITE_JAMENDO_CLIENT_ID não está configurada no frontend. ' +
        'As músicas online dependem do JAMENDO_CLIENT_ID configurado no backend (/bot/tracks e /bot/search).'
    );
    return [];
  }

  const executeQuery = async (offset: number): Promise<CuratedTrack[]> => {
    const params = new URLSearchParams({
      client_id: clientId,
      format: 'json',
      limit: '12',
      offset: String(offset),
      audioformat: 'mp32',
      audiodlformat: 'mp32',
      order: 'popularity_total',
      // Usa espaço (que URLSearchParams codifica como '+'), evitando double-encode '%2B'
      fuzzytags: query ? `${translateQuery(query)} relaxing` : 'ambient relaxation meditation',
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
  };

  const randomOffset = Math.floor(Math.random() * 40);
  let tracks = await executeQuery(randomOffset);
  if (tracks.length === 0 && randomOffset > 0) {
    tracks = await executeQuery(0);
  }

  return shuffleTracks(tracks);
}

/**
 * Garante que a lista online tenha faixas reais do Jamendo (embaralhadas) e mantém
 * o áudio local disponível no final como opção de segurança.
 */
function mergeWithLocalFallback(onlineTracks: CuratedTrack[]): CuratedTrack[] {
  const onlyExternal = onlineTracks.filter(
    (t) => t.source === 'jamendo' || t.audioUrl.startsWith('https://')
  );
  if (onlyExternal.length === 0) {
    return [LOCAL_FALLBACK_TRACK];
  }
  return [...shuffleTracks(onlyExternal), LOCAL_FALLBACK_TRACK];
}

/**
 * Busca faixas relaxantes curadas para o usuário (via backend Express -> Jamendo API v3,
 * com fallback direto via VITE_JAMENDO_CLIENT_ID se o backend retornar apenas faixas locais).
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
        const incoming = Array.isArray(data.tracks) ? data.tracks : [];
        const hasOnlineTracks = incoming.some(
          (t) => t.source === 'jamendo' || t.audioUrl.startsWith('https://')
        );
        if (hasOnlineTracks) {
          return mergeWithLocalFallback(incoming);
        }
      }
    } catch {
      // Tenta fallback direto abaixo
    }
  }

  try {
    const directTracks = await fetchDirectlyFromJamendo();
    if (directTracks.length > 0) {
      return mergeWithLocalFallback(directTracks);
    }
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
        const incoming = Array.isArray(data.tracks) ? data.tracks : [];
        const hasOnlineTracks = incoming.some(
          (t) => t.source === 'jamendo' || t.audioUrl.startsWith('https://')
        );
        if (hasOnlineTracks) {
          return mergeWithLocalFallback(incoming);
        }
      }
    } catch {
      // Tenta fallback direto
    }
  }

  try {
    const directTracks = await fetchDirectlyFromJamendo(cleaned);
    if (directTracks.length > 0) {
      return mergeWithLocalFallback(directTracks);
    }
  } catch {
    // Sem rede ou Jamendo indisponível
  }

  return [];
}
