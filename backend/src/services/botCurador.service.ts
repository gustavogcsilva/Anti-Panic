import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

export interface CuratedTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  duration: number;
  coverUrl: string | null;
  genre: string;
  moodTag: 'happy' | 'uplifting' | 'calming' | 'relaxing';
  licenseUrl: string | null;
}

interface JamendoTrackResult {
  id: string;
  name: string;
  artist_name: string;
  duration: number;
  audio: string;
  image?: string;
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
const TARGET_TRACK_COUNT = 5;
const JAMENDO_POOL_LIMIT = 25;
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 420;
const PERSONALIZED_MOODS: Array<'happy' | 'uplifting'> = ['happy', 'uplifting'];
const RANDOM_CALM_MOODS: Array<'calming' | 'uplifting' | 'relaxing'> = [
  'calming',
  'uplifting',
  'relaxing',
];

export class BotCuradorService {
  private readonly prisma: PrismaClient;
  private readonly jamendoClientId: string;

  constructor(prisma: PrismaClient, jamendoClientId = env.JAMENDO_CLIENT_ID) {
    this.prisma = prisma;
    this.jamendoClientId = jamendoClientId.trim();
  }

  /**
   * Lê as preferências musicais do usuário (gêneros, artistas ou modoAleatorio),
   * consulta a API gratuita do Jamendo e retorna 5 URLs diretas de MP3 aleatórias.
   */
  public async getCuratedTracksForUser(userId: string): Promise<CuratedTrack[]> {
    if (!this.jamendoClientId) {
      throw new BotCuradorError(
        'JAMENDO_CLIENT_ID não configurado no servidor.',
        500
      );
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
      for (const moodTag of RANDOM_CALM_MOODS) {
        queryPromises.push(this.fetchFromJamendo({ moodTag }));
      }
    } else {
      // 1. Consulta pelos gêneros favoritos combinados com humor alegre/acolhedor
      for (const genre of this.shuffleArray(genres).slice(0, 3)) {
        const moodTag = this.pickRandom(PERSONALIZED_MOODS);
        queryPromises.push(this.fetchFromJamendo({ genre, moodTag }));
      }

      // 2. Consulta pelos artistas preferidos do usuário
      for (const artist of this.shuffleArray(artists).slice(0, 3)) {
        queryPromises.push(
          this.fetchFromJamendo({
            artistQuery: artist,
            moodTag: 'uplifting',
          })
        );
      }
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

    // Fallback: se os filtros personalizados retornaram menos de 5 faixas (ex: artista
    // comercial fora do catálogo Creative Commons do Jamendo), completa com faixas
    // calmantes/alegres para garantir sempre 5 MP3s offline disponíveis
    if (trackMap.size < TARGET_TRACK_COUNT) {
      const fallbackMood = this.pickRandom(RANDOM_CALM_MOODS);
      const fallbackTracks = await this.fetchFromJamendo({ moodTag: fallbackMood });

      for (const track of fallbackTracks) {
        if (!trackMap.has(track.id)) {
          trackMap.set(track.id, track);
        }
      }
    }

    const curatedPool = Array.from(trackMap.values());

    if (curatedPool.length === 0) {
      throw new BotCuradorError(
        'Não foi possível obter músicas no Jamendo no momento.',
        503
      );
    }

    return this.shuffleArray(curatedPool).slice(0, TARGET_TRACK_COUNT);
  }

  private async fetchFromJamendo(params: {
    genre?: string;
    artistQuery?: string;
    moodTag: 'happy' | 'uplifting' | 'calming' | 'relaxing';
  }): Promise<CuratedTrack[]> {
    const { genre, artistQuery, moodTag } = params;

    const searchParams = new URLSearchParams({
      client_id: this.jamendoClientId,
      format: 'json',
      limit: String(JAMENDO_POOL_LIMIT),
      audioformat: 'mp32',
      include: 'musicinfo',
      boost: 'popularity_total',
      groupby: 'artist_id',
    });

    if (artistQuery) {
      searchParams.set('namesearch', artistQuery);
    } else {
      const sanitizedGenre = genre
        ? genre.toLowerCase().replace(/[^a-z0-9-]/g, '')
        : '';
      searchParams.set(
        'fuzzytags',
        sanitizedGenre ? `${sanitizedGenre}+${moodTag}` : moodTag
      );
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
        .map((track): CuratedTrack => ({
          id: String(track.id),
          title: track.name.trim(),
          artist: track.artist_name.trim(),
          audioUrl: track.audio,
          duration: track.duration,
          coverUrl: track.image || null,
          genre: genre ?? track.musicinfo?.tags?.genres?.[0] ?? moodTag,
          moodTag,
          licenseUrl: track.license_ccurl || null,
        }));
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
