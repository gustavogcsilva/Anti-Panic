import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/appError';

export interface UpsertPreferencesInput {
  nomeAmigo?: string;
  temaNoturno?: boolean;
  generosMusicais: string[];
  artistasPreferidos: string[];
  modoAleatorio: boolean;
  contatoEmergenciaNome?: string | null;
  contatoEmergenciaTelefone?: string | null;
}

function sanitizeFriendName(raw?: string | null): string {
  if (!raw) return 'Amigo';
  const cleaned = raw
    .replace(/[<>"'`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return cleaned.length >= 2 ? cleaned : 'Amigo';
}

export class PreferencesService {
  constructor(private readonly prisma: PrismaClient) {}

  public async getPreferences(userId: string) {
    const preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return {
        nomeAmigo: 'Amigo',
        temaNoturno: false,
        generosMusicais: [],
        artistasPreferidos: [],
        modoAleatorio: false,
        contatoEmergenciaNome: null,
        contatoEmergenciaTelefone: null,
        hasPreferences: false,
      };
    }

    return {
      id: preferences.id,
      nomeAmigo: preferences.nomeAmigo || 'Amigo',
      temaNoturno: Boolean(preferences.temaNoturno),
      generosMusicais: preferences.generosMusicais,
      artistasPreferidos: preferences.artistasPreferidos,
      modoAleatorio: preferences.modoAleatorio,
      contatoEmergenciaNome: preferences.contatoEmergenciaNome,
      contatoEmergenciaTelefone: preferences.contatoEmergenciaTelefone,
      hasPreferences:
        preferences.modoAleatorio ||
        preferences.generosMusicais.length > 0 ||
        preferences.artistasPreferidos.length > 0,
    };
  }

  public async upsertPreferences(userId: string, input: UpsertPreferencesInput) {
    const generosMusicais = Array.from(
      new Set(
        input.generosMusicais
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    ).slice(0, 10);

    const artistasPreferidos = Array.from(
      new Set(
        input.artistasPreferidos
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    ).slice(0, 10);

    if (
      !input.modoAleatorio &&
      generosMusicais.length === 0 &&
      artistasPreferidos.length === 0
    ) {
      throw new AppError(
        'Escolha pelo menos um gênero musical, um artista preferido ou ative o Modo Aleatório.',
        400
      );
    }

    const nomeAmigo = sanitizeFriendName(input.nomeAmigo);
    const contatoEmergenciaNome = input.contatoEmergenciaNome?.trim() || null;
    const contatoEmergenciaTelefone =
      input.contatoEmergenciaTelefone?.replace(/[^\d+]/g, '').trim() || null;

    const saved = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        nomeAmigo,
        temaNoturno: Boolean(input.temaNoturno),
        generosMusicais,
        artistasPreferidos,
        modoAleatorio: input.modoAleatorio,
        contatoEmergenciaNome,
        contatoEmergenciaTelefone,
      },
      update: {
        ...(input.nomeAmigo !== undefined ? { nomeAmigo } : {}),
        ...(input.temaNoturno !== undefined ? { temaNoturno: input.temaNoturno } : {}),
        generosMusicais,
        artistasPreferidos,
        modoAleatorio: input.modoAleatorio,
        contatoEmergenciaNome,
        contatoEmergenciaTelefone,
      },
    });

    return {
      id: saved.id,
      nomeAmigo: saved.nomeAmigo || 'Amigo',
      temaNoturno: Boolean(saved.temaNoturno),
      generosMusicais: saved.generosMusicais,
      artistasPreferidos: saved.artistasPreferidos,
      modoAleatorio: saved.modoAleatorio,
      contatoEmergenciaNome: saved.contatoEmergenciaNome,
      contatoEmergenciaTelefone: saved.contatoEmergenciaTelefone,
      hasPreferences: true,
    };
  }

  public async updateFriendName(userId: string, rawName: string) {
    const nomeAmigo = sanitizeFriendName(rawName);

    const saved = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        nomeAmigo,
        generosMusicais: [],
        artistasPreferidos: [],
        modoAleatorio: true,
      },
      update: {
        nomeAmigo,
      },
    });

    return {
      id: saved.id,
      nomeAmigo: saved.nomeAmigo,
      temaNoturno: Boolean(saved.temaNoturno),
      generosMusicais: saved.generosMusicais,
      artistasPreferidos: saved.artistasPreferidos,
      modoAleatorio: saved.modoAleatorio,
      contatoEmergenciaNome: saved.contatoEmergenciaNome,
      contatoEmergenciaTelefone: saved.contatoEmergenciaTelefone,
      hasPreferences:
        saved.modoAleatorio ||
        saved.generosMusicais.length > 0 ||
        saved.artistasPreferidos.length > 0,
    };
  }

  public async updateTheme(userId: string, temaNoturno: boolean) {
    const saved = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        nomeAmigo: 'Amigo',
        temaNoturno,
        generosMusicais: [],
        artistasPreferidos: [],
        modoAleatorio: true,
      },
      update: {
        temaNoturno,
      },
    });

    return {
      id: saved.id,
      nomeAmigo: saved.nomeAmigo,
      temaNoturno: Boolean(saved.temaNoturno),
      generosMusicais: saved.generosMusicais,
      artistasPreferidos: saved.artistasPreferidos,
      modoAleatorio: saved.modoAleatorio,
      contatoEmergenciaNome: saved.contatoEmergenciaNome,
      contatoEmergenciaTelefone: saved.contatoEmergenciaTelefone,
      hasPreferences:
        saved.modoAleatorio ||
        saved.generosMusicais.length > 0 ||
        saved.artistasPreferidos.length > 0,
    };
  }
}
