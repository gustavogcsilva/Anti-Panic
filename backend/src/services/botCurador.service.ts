import { PrismaClient } from '@prisma/client';

export type SynthPreset =
  | 'rain'
  | 'brown-noise'
  | 'pink-noise'
  | 'white-noise'
  | 'ocean'
  | 'zen-pad';

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
  source: 'synthesizer' | 'local';
  synthPreset?: SynthPreset;
  tags: string[];
}

export class BotCuradorError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'BotCuradorError';
    this.statusCode = statusCode;
  }
}

/**
 * Catálogo estruturado 100% gratuito, sem CORS, sem expiração de token e 100% compatível
 * com Safari iOS, Chrome Android e modo offline (PWA):
 * - Paisagens sonoras sintetizadas em tempo real via Web Audio API (chuva, ruído marrom/rosa/branco, ondas, zen 432Hz)
 * - Áudios locais em public/audio/ pré-cacheados pelo Service Worker
 */
export const RELAXING_AUDIO_CATALOG: CuratedTrack[] = [
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
    licenseUrl: null,
    source: 'synthesizer',
    synthPreset: 'rain',
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
    licenseUrl: null,
    source: 'synthesizer',
    synthPreset: 'brown-noise',
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
    licenseUrl: null,
    source: 'synthesizer',
    synthPreset: 'ocean',
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
    licenseUrl: null,
    source: 'local',
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
    licenseUrl: null,
    source: 'synthesizer',
    synthPreset: 'pink-noise',
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
    licenseUrl: null,
    source: 'local',
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
    licenseUrl: null,
    source: 'synthesizer',
    synthPreset: 'zen-pad',
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
    licenseUrl: null,
    source: 'synthesizer',
    synthPreset: 'white-noise',
    tags: ['ruido', 'branco', 'white', 'silencio', 'sono', 'foco'],
  },
  {
    id: 'local-calm-1',
    title: 'Respiração Serena (Acorde Acolhedor)',
    artist: 'Respira Studio (Offline)',
    audioUrl: '/audio/fallback-calm.wav',
    downloadUrl: '/audio/fallback-calm.wav',
    audioDownloadAllowed: true,
    duration: 12,
    coverUrl: null,
    genre: 'ambiente',
    moodTag: 'calming',
    licenseUrl: null,
    source: 'local',
    tags: ['ambiente', 'ambient', 'calma', 'respiracao', 'emergencia', 'offline'],
  },
];

export class BotCuradorService {
  constructor(private readonly prisma: PrismaClient) {}

  public async getCuratedTracksForUser(userId: string): Promise<CuratedTrack[]> {
    const preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        generosMusicais: true,
        modoAleatorio: true,
      },
    });

    const userGenres = (preferences?.generosMusicais ?? []).map((g) => this.normalize(g));

    if (preferences?.modoAleatorio || userGenres.length === 0) {
      return this.shuffleArray(RELAXING_AUDIO_CATALOG);
    }

    // Prioriza faixas que combinam com as preferências musicais do usuário mantendo o catálogo completo
    const prioritized = [...RELAXING_AUDIO_CATALOG].sort((a, b) => {
      const scoreA = this.computePreferenceScore(a, userGenres);
      const scoreB = this.computePreferenceScore(b, userGenres);
      return scoreB - scoreA;
    });

    return prioritized;
  }

  public async searchRelaxingTracks(rawQuery: string, limit = 10): Promise<CuratedTrack[]> {
    const normalizedQuery = this.normalize(rawQuery);
    const safeLimit = Math.min(Math.max(limit, 1), RELAXING_AUDIO_CATALOG.length);

    if (!normalizedQuery) {
      return this.shuffleArray(RELAXING_AUDIO_CATALOG).slice(0, safeLimit);
    }

    const terms = normalizedQuery.split(/\s+/).filter(Boolean);

    const matches = RELAXING_AUDIO_CATALOG.filter((track) => {
      const searchable = this.normalize(
        `${track.title} ${track.artist} ${track.genre} ${track.tags.join(' ')}`
      );
      return terms.some((term) => searchable.includes(term));
    });

    if (matches.length === 0) {
      return this.shuffleArray(RELAXING_AUDIO_CATALOG).slice(0, safeLimit);
    }

    const remaining = RELAXING_AUDIO_CATALOG.filter(
      (t) => !matches.some((m) => m.id === t.id)
    );

    return [...matches, ...this.shuffleArray(remaining)].slice(0, safeLimit);
  }

  private computePreferenceScore(track: CuratedTrack, normalizedGenres: string[]): number {
    const searchable = this.normalize(`${track.genre} ${track.tags.join(' ')}`);
    let score = 0;
    for (const g of normalizedGenres) {
      if (searchable.includes(g)) score += 2;
    }
    return score + Math.random() * 0.5;
  }

  private normalize(raw: string): string {
    return raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
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
