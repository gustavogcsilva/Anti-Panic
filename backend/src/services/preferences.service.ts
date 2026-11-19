import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/appError';

export interface UpsertPreferencesInput {
  generosMusicais: string[];
  artistasPreferidos: string[];
  modoAleatorio: boolean;
  contatoEmergenciaNome?: string | null;
  contatoEmergenciaTelefone?: string | null;
}

export class PreferencesService {
  constructor(private readonly prisma: PrismaClient) {}

  public async getPreferences(userId: string) {
    const preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return {
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

    const contatoEmergenciaNome = input.contatoEmergenciaNome?.trim() || null;
    const contatoEmergenciaTelefone =
      input.contatoEmergenciaTelefone?.replace(/[^\d+]/g, '').trim() || null;

    const saved = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        generosMusicais,
        artistasPreferidos,
        modoAleatorio: input.modoAleatorio,
        contatoEmergenciaNome,
        contatoEmergenciaTelefone,
      },
      update: {
        generosMusicais,
        artistasPreferidos,
        modoAleatorio: input.modoAleatorio,
        contatoEmergenciaNome,
        contatoEmergenciaTelefone,
      },
    });

    return {
      id: saved.id,
      generosMusicais: saved.generosMusicais,
      artistasPreferidos: saved.artistasPreferidos,
      modoAleatorio: saved.modoAleatorio,
      contatoEmergenciaNome: saved.contatoEmergenciaNome,
      contatoEmergenciaTelefone: saved.contatoEmergenciaTelefone,
      hasPreferences: true,
    };
  }
}
