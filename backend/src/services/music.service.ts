export interface RandomArtistTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string | null;
  audioUrl: string;
  source: 'deezer' | 'itunes' | 'local';
  duration: number;
}

interface DeezerSearchTrack {
  id: number;
  title?: string;
  preview?: string;
  duration?: number;
  artist?: { name?: string };
  album?: {
    title?: string;
    cover_medium?: string;
    cover_big?: string;
    cover?: string;
  };
}

interface DeezerApiResponse {
  data?: DeezerSearchTrack[];
}

interface ItunesSearchTrack {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
}

interface ItunesApiResponse {
  results?: ItunesSearchTrack[];
}

export const DEFAULT_CALM_ARTISTS = [
  'Ludovico Einaudi',
  'Nils Frahm',
  'Max Richter',
  'Yiruma',
  'Ólafur Arnalds',
  'Brian Eno',
  'A Winged Victory for the Sullen',
];

const REQUEST_TIMEOUT_MS = 8_000;

export class MusicService {
  /**
   * Sorteia uma faixa aleatória para o cantor informado (ou de uma lista padrão de sons calmos).
   * 1) Consulta Deezer Public API (sem API key) filtrando itens com `preview` válido.
   * 2) Fallback automático para iTunes Search API filtrando itens com `previewUrl` válido.
   * 3) Fallback local seguro se ambas as APIs externas estiverem inacessíveis.
   */
  public async getRandomTrackByArtist(rawArtist?: string): Promise<RandomArtistTrack> {
    const trimmedArtist = rawArtist?.trim().slice(0, 100) || '';
    const chosenArtist =
      trimmedArtist ||
      DEFAULT_CALM_ARTISTS[Math.floor(Math.random() * DEFAULT_CALM_ARTISTS.length)];

    // 1. Tenta Deezer Public API
    const deezerTracks = await this.fetchFromDeezer(chosenArtist);
    if (deezerTracks.length > 0) {
      return deezerTracks[Math.floor(Math.random() * deezerTracks.length)];
    }

    // 2. Fallback automático para iTunes Search API
    const itunesTracks = await this.fetchFromItunes(chosenArtist);
    if (itunesTracks.length > 0) {
      return itunesTracks[Math.floor(Math.random() * itunesTracks.length)];
    }

    // 3. Fallback local de segurança (evita quebrar o player em caso de indisponibilidade de rede)
    return {
      id: `local-fallback-${Date.now()}`,
      title: 'Piano Suave para Desacelerar',
      artist: chosenArtist,
      album: 'Respira Studio (Modo Offline)',
      cover: null,
      audioUrl: '/audio/piano-suave.wav',
      source: 'local',
      duration: 12,
    };
  }

  private async fetchFromDeezer(artist: string): Promise<RandomArtistTrack[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = `https://api.deezer.com/search?q=artist:"${encodeURIComponent(artist)}"&limit=25`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) return [];

      const payload = (await response.json()) as DeezerApiResponse;
      const validItems = (payload.data ?? []).filter(
        (item) => typeof item.preview === 'string' && item.preview.startsWith('https://')
      );

      return validItems.map((item) => ({
        id: `deezer-${item.id}`,
        title: item.title?.trim() || 'Faixa Relaxante',
        artist: item.artist?.name?.trim() || artist,
        album: item.album?.title?.trim() || 'Álbum',
        cover: item.album?.cover_big || item.album?.cover_medium || item.album?.cover || null,
        audioUrl: item.preview!,
        source: 'deezer' as const,
        duration: 30,
      }));
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchFromItunes(artist: string): Promise<RandomArtistTrack[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=song&limit=25`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) return [];

      const payload = (await response.json()) as ItunesApiResponse;
      const validItems = (payload.results ?? []).filter(
        (item) => typeof item.previewUrl === 'string' && item.previewUrl.startsWith('https://')
      );

      return validItems.map((item, idx) => ({
        id: `itunes-${item.trackId ?? idx}`,
        title: item.trackName?.trim() || 'Faixa Relaxante',
        artist: item.artistName?.trim() || artist,
        album: item.collectionName?.trim() || 'Álbum',
        cover: item.artworkUrl100
          ? item.artworkUrl100.replace('100x100bb', '300x300bb')
          : null,
        audioUrl: item.previewUrl!,
        source: 'itunes' as const,
        duration: 30,
      }));
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}
