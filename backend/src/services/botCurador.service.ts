import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

export interface CuratedTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  downloadUrl: string;
  audioDownloadAllowed: boolean;
  duration: number;
  coverUrl: string | null;
  genre: string;
  moodTag: 'happy' | 'uplifting' | 'calming' | 'relaxing';
  licenseUrl: string | null;
  source: 'jamendo' | 'local';
}

interface JamendoTrackResult {
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
  musicinfo?: {
    tags?: {
      genres?: string[];
      vartags?: string[];
    };
  };
}

interface JamendoApiResponse {
  headers: {
    status: string;
    code: number;
    error_message: string;
    results_count: number;
  };
  results: JamendoTrackResult[];
}

export class BotCuradorError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'BotCuradorError';
    this.statusCode = statusCode;
  }
}

const JAMENDO_API_URL = 'https://api.jamendo.com/v3.0/tracks/';
const TARGET_TRACK_COUNT = 8;
const JAMENDO_POOL_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 10_000;
const MIN_DURATION_SECONDS = 45;
const MAX_DURATION_SECONDS = 600;
const PERSONALIZED_MOODS: Array<'happy' | 'uplifting' | 'calming' | 'relaxing'> = [
  'calming',
  'relaxing',
  'uplifting',
];
const RELAXING_DEFAULT_TAGS = ['ambient+relaxation', 'meditation+relaxing', 'ambient+calm'];

const PT_TO_EN_MOOD_MAP: Record<string, string> = {
  chuva: 'rain',
  piano: 'piano',
  meditacao: 'meditation',
  meditar: 'meditation',
  natureza: 'nature',
  floresta: 'forest',
  mar: 'ocean',
  oceano: 'ocean',
  sono: 'sleep',
  dormir: 'sleep',
  calma: 'calm',
  calmo: 'calm',
  relaxar: 'relaxation',
  relaxante: 'relaxing',
  ambiente: 'ambient',
  paz: 'peaceful',
  acustico: 'acoustic',
  violao: 'acoustic',
  instrumental: 'instrumental',
  lofi: 'lofi',
  'lo-fi': 'lofi',
  foco: 'chillout',
  ansiedade: 'meditation',
};

const FALLBACK_CURATED_TRACKS: CuratedTrack[] = [
  {
    id: 'local-calm-1',
    title: 'Respiração Serena (Acorde Acolhedor)',
    artist: 'Respira Studio (Offline)',
    audioUrl: '/audio/fallback-calm.wav',
    downloadUrl: '/audio/fallback-calm.wav',
    audioDownloadAllowed: true,
    duration: 12,
    coverUrl: null,
    genre: 'ambient',
    moodTag: 'calming',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'local',
  },
  {
    id: 'local-calm-2',
    title: 'Harmonia para Desacelerar (Modo Local)',
    artist: 'Respira Studio (Offline)',
    audioUrl: '/audio/fallback-calm.wav',
    downloadUrl: '/audio/fallback-calm.wav',
    audioDownloadAllowed: true,
    duration: 12,
    coverUrl: null,
    genre: 'relaxation',
    moodTag: 'relaxing',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'local',
  },
];

export class BotCuradorService {
  private readonly prisma: PrismaClient;
  private readonly jamendoClientId: string;

  constructor(prisma: PrismaClient, jamendoClientId = env.JAMENDO_CLIENT_ID) {
    this.prisma = prisma;
    this.jamendoClientId = jamendoClientId.trim();
  }

  public hasValidJamendoKey(): boolean {
    return (
      Boolean(this.jamendoClientId) &&
      this.jamendoClientId !== 'seu-client-id-jamendo' &&
      this.jamendoClientId.length >= 6
    );
  }

  /**
   * Lê as preferências musicais do usuário (gêneros, artistas ou modoAleatorio),
   * consulta a API gratuita do Jamendo (faixas instrumentais/relaxantes) e retorna
   * URLs diretas de streaming (track.audio) e download (track.audiodownload).
   */
  public async getCuratedTracksForUser(userId: string): Promise<CuratedTrack[]> {
    if (!this.hasValidJamendoKey()) {
      return [...FALLBACK_CURATED_TRACKS];
    }

    const preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        generosMusicais: true,
        artistasPreferidos: true,
        modoAleatorio: true,
      },
    });

    const genres = this.normalizeList(preferences?.generosMusicais);
    const artists = this.normalizeList(preferences?.artistasPreferidos);
    const useRandomMode =
      Boolean(preferences?.modoAleatorio) || (genres.length === 0 && artists.length === 0);

    const queryPromises: Array<Promise<CuratedTrack[]>> = [];

    if (useRandomMode) {
      // Busca faixas instrumentais e relaxantes no Jamendo com tags dedicadas
      queryPromises.push(
        this.fetchFromJamendo({
          tags: 'ambient+relaxation+meditation',
          moodTag: 'calming',
          instrumental: true,
        })
      );
      for (const tagCombo of RELAXING_DEFAULT_TAGS) {
        queryPromises.push(
          this.fetchFromJamendo({
            fuzzytags: tagCombo,
            moodTag: 'relaxing',
          })
        );
      }
    } else {
      // 1. Consulta pelos gêneros favoritos combinados com humor calmante/relaxante
      for (const genre of this.shuffleArray(genres).slice(0, 3)) {
        const moodTag = this.pickRandom(PERSONALIZED_MOODS);
        const mappedGenre = this.translateSearchTerm(genre);
        queryPromises.push(
          this.fetchFromJamendo({
            fuzzytags: `${mappedGenre}+${moodTag}`,
            genreLabel: genre,
            moodTag,
          })
        );
      }

      // 2. Consulta pelos artistas preferidos do usuário
      for (const artist of this.shuffleArray(artists).slice(0, 2)) {
        queryPromises.push(
          this.fetchFromJamendo({
            search: artist,
            moodTag: 'uplifting',
          })
        );
      }

      // 3. Sempre inclui uma consulta relaxante/ambient para garantir catálogo rico
      queryPromises.push(
        this.fetchFromJamendo({
          fuzzytags: 'ambient+relaxation+meditation',
          moodTag: 'calming',
        })
      );
    }

    const settledResults = await Promise.allSettled(queryPromises);
    const trackMap = new Map<string, CuratedTrack>();

    for (const result of settledResults) {
      if (result.status === 'fulfilled') {
        for (const track of result.value) {
          if (!trackMap.has(track.id)) {
            trackMap.set(track.id, track);
          }
        }
      }
    }

    // Fallback secundário no Jamendo com mp31 e tag ampla caso a primeira consulta retorne poucas faixas
    if (trackMap.size < 4) {
      try {
        const broadTracks = await this.fetchFromJamendo({
          fuzzytags: 'ambient+relaxing',
          moodTag: 'relaxing',
          audioFormat: 'mp31',
        });
        for (const track of broadTracks) {
          if (!trackMap.has(track.id)) {
            trackMap.set(track.id, track);
          }
        }
      } catch {
        // Ignora e segue para fallback local se necessário
      }
    }

    const curatedPool = Array.from(trackMap.values());
    if (curatedPool.length === 0) {
      return [...FALLBACK_CURATED_TRACKS];
    }

    return this.shuffleArray(curatedPool).slice(0, TARGET_TRACK_COUNT);
  }

  /**
   * Busca faixas relaxantes na API do Jamendo por termo/humor (ex: "chuva", "piano", "meditação", "natureza").
   */
  public async searchRelaxingTracks(rawQuery: string, limit = 10): Promise<CuratedTrack[]> {
    const cleanedQuery = rawQuery.trim().slice(0, 80);
    if (!this.hasValidJamendoKey()) {
      return [...FALLBACK_CURATED_TRACKS];
    }

    const translated = this.translateSearchTerm(cleanedQuery);
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    const queryPromises: Array<Promise<CuratedTrack[]>> = [];

    if (translated) {
      // 1. Busca por tags combinadas (ex: "rain+ambient", "piano+relaxing", "meditation")
      queryPromises.push(
        this.fetchFromJamendo({
          fuzzytags: `${translated}+relaxing`,
          moodTag: 'relaxing',
          genreLabel: cleanedQuery,
          limit: safeLimit,
        })
      );
      // 2. Busca por nome/termo livre
      queryPromises.push(
        this.fetchFromJamendo({
          search: translated,
          moodTag: 'calming',
          genreLabel: cleanedQuery,
          limit: safeLimit,
        })
      );
    } else {
      queryPromises.push(
        this.fetchFromJamendo({
          fuzzytags: 'ambient+relaxation+meditation',
          moodTag: 'calming',
          limit: safeLimit,
        })
      );
    }

    const settled = await Promise.allSettled(queryPromises);
    const trackMap = new Map<string, CuratedTrack>();

    for (const res of settled) {
      if (res.status === 'fulfilled') {
        for (const track of res.value) {
          if (!trackMap.has(track.id)) {
            trackMap.set(track.id, track);
          }
        }
      }
    }

    // Se a busca específica não achou nada, faz fallback para tags instrumentais relaxantes no Jamendo
    if (trackMap.size === 0) {
      try {
        const fallbackJamendo = await this.fetchFromJamendo({
          fuzzytags: 'ambient+relaxation+meditation',
          moodTag: 'calming',
          limit: safeLimit,
        });
        for (const track of fallbackJamendo) {
          trackMap.set(track.id, track);
        }
      } catch {
        // Retorna fallback local abaixo
      }
    }

    const list = Array.from(trackMap.values());
    if (list.length === 0) {
      return [...FALLBACK_CURATED_TRACKS];
    }

    return list.slice(0, safeLimit);
  }

  private async fetchFromJamendo(params: {
    tags?: string;
    fuzzytags?: string;
    search?: string;
    genreLabel?: string;
    moodTag: 'happy' | 'uplifting' | 'calming' | 'relaxing';
    instrumental?: boolean;
    audioFormat?: 'mp32' | 'mp31';
    limit?: number;
  }): Promise<CuratedTrack[]> {
    const {
      tags,
      fuzzytags,
      search,
      genreLabel,
      moodTag,
      instrumental = false,
      audioFormat = 'mp32',
      limit = JAMENDO_POOL_LIMIT,
    } = params;

    const searchParams = new URLSearchParams({
      client_id: this.jamendoClientId,
      format: 'json',
      limit: String(limit),
      audioformat: audioFormat,
      audiodlformat: audioFormat,
      include: 'musicinfo',
      order: 'popularity_total',
      groupby: 'artist_id',
    });

    if (instrumental) {
      searchParams.set('vocalinstrumental', 'instrumental');
    }

    if (search) {
      searchParams.set('search', search);
    } else if (tags) {
      searchParams.set('tags', tags);
    } else if (fuzzytags) {
      searchParams.set('fuzzytags', fuzzytags);
    } else {
      searchParams.set('fuzzytags', 'ambient+relaxation+meditation');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${JAMENDO_API_URL}?${searchParams.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BotCuradorError(
          `Jamendo API respondeu com status HTTP ${response.status}.`,
          502
        );
      }

      const payload = (await response.json()) as JamendoApiResponse;

      if (payload.headers?.status !== 'success') {
        throw new BotCuradorError(
          payload.headers?.error_message || 'Erro retornado pela Jamendo API.',
          502
        );
      }

      return (payload.results ?? [])
        .filter((track) => this.isValidTrack(track))
        .map((track): CuratedTrack => {
          const streamUrl = track.audio.trim();
          const downloadUrl =
            track.audiodownload && track.audiodownload.startsWith('https://')
              ? track.audiodownload.trim()
              : streamUrl;

          return {
            id: String(track.id),
            title: track.name.trim(),
            artist: track.artist_name.trim(),
            audioUrl: streamUrl,
            downloadUrl,
            audioDownloadAllowed: Boolean(track.audiodownload_allowed ?? true),
            duration: track.duration,
            coverUrl: track.image || track.album_image || null,
            genre: genreLabel ?? track.musicinfo?.tags?.genres?.[0] ?? moodTag,
            moodTag,
            licenseUrl: track.license_ccurl || null,
            source: 'jamendo',
          };
        });
    } catch (error) {
      if (error instanceof BotCuradorError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new BotCuradorError('Tempo limite excedido ao consultar a Jamendo API.', 504);
      }

      throw new BotCuradorError(
        `Falha de comunicação com a Jamendo API: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
        502
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private translateSearchTerm(raw: string): string {
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (!normalized) return '';

    const words = normalized.split(/\s+/).filter(Boolean);
    const mapped = words.map((w) => PT_TO_EN_MOOD_MAP[w] ?? w.replace(/[^a-z0-9-]/g, ''));
    return mapped.filter(Boolean).join('+');
  }

  private isValidTrack(track: JamendoTrackResult): boolean {
    if (!track.audio || !track.audio.startsWith('https://')) {
      return false;
    }

    if (
      typeof track.duration !== 'number' ||
      track.duration < MIN_DURATION_SECONDS ||
      track.duration > MAX_DURATION_SECONDS
    ) {
      return false;
    }

    return Boolean(track.id && track.name && track.artist_name);
  }

  private normalizeList(items?: string[] | null): string[] {
    if (!items || items.length === 0) return [];
    return Array.from(
      new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))
    );
  }

  private pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  private shuffleArray<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
