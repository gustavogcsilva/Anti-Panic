import type { CuratedTrack } from '../types';
import { API_BASE_URL, AUTH_TOKEN_STORAGE_KEY } from './api';

export const LOCAL_FALLBACK_AUDIO_URL = '/audio/fallback-calm.wav';

/**
 * Catálogo local 100% confiável e zero-custo (Web Audio API + WAVs precacheados em public/audio/).
 * Garante funcionamento instantâneo sem CORS, sem chaves externas e até no modo avião do PWA.
 */
export const DEFAULT_RELAXING_CATALOG: CuratedTrack[] = [
  {
    id: 'synth-rain',
    title: 'Chuva Suave na Janela',
    artist: 'Paisagem Sonora • Web Audio',
    audioUrl: 'synth://rain',
    downloadUrl: 'synth://rain',
    audioDownloadAllowed: true,
    duration: 600,
    coverUrl: null,
    genre: 'natureza',
    moodTag: 'calming',
    source: 'synthesizer',
    synthPreset: 'rain',
    isCached: true,
    tags: ['chuva', 'rain', 'natureza', 'sono', 'calma', 'ambient', 'relaxante'],
  },
  {
    id: 'synth-brown-noise',
    title: 'Ruído Marrom Profundo (Alívio de Ansiedade)',
    artist: 'Terapia Sonora • Web Audio',
    audioUrl: 'synth://brown-noise',
    downloadUrl: 'synth://brown-noise',
    audioDownloadAllowed: true,
    duration: 600,
    coverUrl: null,
    genre: 'ruído marrom',
    moodTag: 'calming',
    source: 'synthesizer',
    synthPreset: 'brown-noise',
    isCached: true,
    tags: ['ruido', 'marrom', 'brown', 'foco', 'ansiedade', 'sono', 'calma'],
  },
  {
    id: 'synth-ocean',
    title: 'Ondas do Mar (Ritmo 4-2-6)',
    artist: 'Paisagem Sonora • Web Audio',
    audioUrl: 'synth://ocean',
    downloadUrl: 'synth://ocean',
    audioDownloadAllowed: true,
    duration: 600,
    coverUrl: null,
    genre: 'natureza',
    moodTag: 'relaxing',
    source: 'synthesizer',
    synthPreset: 'ocean',
    isCached: true,
    tags: ['mar', 'ondas', 'ocean', 'natureza', 'respiracao', 'praia', 'calma'],
  },
  {
    id: 'local-piano-suave',
    title: 'Piano Suave para Desacelerar',
    artist: 'Respira Studio (Offline)',
    audioUrl: '/audio/piano-suave.wav',
    downloadUrl: '/audio/piano-suave.wav',
    audioDownloadAllowed: true,
    duration: 12,
    coverUrl: null,
    genre: 'piano',
    moodTag: 'relaxing',
    source: 'local',
    isCached: true,
    tags: ['piano', 'classical', 'acoustic', 'acustico', 'instrumental', 'calma', 'melodia'],
  },
  {
    id: 'synth-pink-noise',
    title: 'Ruído Rosa Acolhedor (Sono & Foco)',
    artist: 'Terapia Sonora • Web Audio',
    audioUrl: 'synth://pink-noise',
    downloadUrl: 'synth://pink-noise',
    audioDownloadAllowed: true,
    duration: 600,
    coverUrl: null,
    genre: 'ruído rosa',
    moodTag: 'relaxing',
    source: 'synthesizer',
    synthPreset: 'pink-noise',
    isCached: true,
    tags: ['ruido', 'rosa', 'pink', 'sono', 'dormir', 'foco', 'lofi'],
  },
  {
    id: 'local-meditacao-noturna',
    title: 'Meditação Noturna 432Hz',
    artist: 'Respira Studio (Offline)',
    audioUrl: '/audio/meditacao-noturna.wav',
    downloadUrl: '/audio/meditacao-noturna.wav',
    audioDownloadAllowed: true,
    duration: 12,
    coverUrl: null,
    genre: 'meditação',
    moodTag: 'calming',
    source: 'local',
    isCached: true,
    tags: ['meditacao', 'meditation', 'noite', 'sono', '432hz', 'ambient', 'paz'],
  },
  {
    id: 'synth-zen-pad',
    title: 'Acorde Zen Respiratório (Harmonia)',
    artist: 'Paisagem Sonora • Web Audio',
    audioUrl: 'synth://zen-pad',
    downloadUrl: 'synth://zen-pad',
    audioDownloadAllowed: true,
    duration: 600,
    coverUrl: null,
    genre: 'meditação',
    moodTag: 'uplifting',
    source: 'synthesizer',
    synthPreset: 'zen-pad',
    isCached: true,
    tags: ['zen', 'meditacao', 'ambient', 'harmonia', 'paz', 'calma'],
  },
  {
    id: 'synth-white-noise',
    title: 'Ruído Branco Suave (Bloqueio de Barulhos)',
    artist: 'Terapia Sonora • Web Audio',
    audioUrl: 'synth://white-noise',
    downloadUrl: 'synth://white-noise',
    audioDownloadAllowed: true,
    duration: 600,
    coverUrl: null,
    genre: 'ruído branco',
    moodTag: 'calming',
    source: 'synthesizer',
    synthPreset: 'white-noise',
    isCached: true,
    tags: ['ruido', 'branco', 'white', 'silencio', 'sono', 'foco'],
  },
  {
    id: 'local-calm-1',
    title: 'Respiração Serena (Acorde Acolhedor)',
    artist: 'Respira Studio (Offline)',
    audioUrl: LOCAL_FALLBACK_AUDIO_URL,
    downloadUrl: LOCAL_FALLBACK_AUDIO_URL,
    audioDownloadAllowed: true,
    duration: 12,
    coverUrl: null,
    genre: 'ambiente',
    moodTag: 'calming',
    source: 'local',
    isCached: true,
    tags: ['ambiente', 'ambient', 'calma', 'respiracao', 'emergencia', 'offline'],
  },
];

export const LOCAL_FALLBACK_TRACK = DEFAULT_RELAXING_CATALOG[0];

function normalizeText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

export function filterLocalCatalog(query: string): CuratedTrack[] {
  const normalized = normalizeText(query);
  if (!normalized) {
    return shuffleTracks(DEFAULT_RELAXING_CATALOG);
  }

  const terms = normalized.split(/\s+/).filter(Boolean);
  const matches = DEFAULT_RELAXING_CATALOG.filter((track) => {
    const searchable = normalizeText(
      `${track.title} ${track.artist} ${track.genre} ${(track.tags ?? []).join(' ')}`
    );
    return terms.some((term) => searchable.includes(term));
  });

  if (matches.length === 0) {
    return shuffleTracks(DEFAULT_RELAXING_CATALOG);
  }

  const remaining = DEFAULT_RELAXING_CATALOG.filter(
    (t) => !matches.some((m) => m.id === t.id)
  );
  return [...matches, ...shuffleTracks(remaining)];
}

/**
 * Busca o catálogo curado de sons relaxantes no backend Express (GET /bot/tracks),
 * com fallback imediato para o catálogo offline integrado (Web Audio API + WAVs locais).
 */
export async function fetchCuratedRelaxingTracks(
  tokenOverride?: string | null
): Promise<CuratedTrack[]> {
  if (!navigator.onLine) {
    return shuffleTracks(DEFAULT_RELAXING_CATALOG);
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
          return data.tracks.map((t) => ({ ...t, isCached: true }));
        }
      }
    } catch {
      // Fallback imediato para o catálogo local
    }
  }

  return shuffleTracks(DEFAULT_RELAXING_CATALOG);
}

/**
 * Pesquisa sons relaxantes por humor/termo (chuva, ruído marrom, piano, meditação, ondas, sono).
 */
export async function searchRelaxingTracks(
  query: string,
  tokenOverride?: string | null
): Promise<CuratedTrack[]> {
  const cleaned = query.trim();

  if (!navigator.onLine) {
    return filterLocalCatalog(cleaned);
  }

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
          return data.tracks.map((t) => ({ ...t, isCached: true }));
        }
      }
    } catch {
      // Fallback imediato para filtro local
    }
  }

  return filterLocalCatalog(cleaned);
}
