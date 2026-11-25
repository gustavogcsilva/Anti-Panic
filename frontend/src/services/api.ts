import type {
  AuthResponse,
  AuthUser,
  CaptchaChallenge,
  ChatMessage,
  ChatMessageType,
  ChatReportData,
  CuratedTrack,
  UserPreferences,
} from '../types';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3333';

export const AUTH_TOKEN_STORAGE_KEY = 'respira_auth_token';

type ColdStartListener = (isColdStarting: boolean) => void;
const coldStartListeners = new Set<ColdStartListener>();
let activeRequestsCount = 0;
let isCurrentlyColdStarting = false;

function setColdStartingState(active: boolean) {
  if (isCurrentlyColdStarting !== active) {
    isCurrentlyColdStarting = active;
    for (const listener of coldStartListeners) {
      try {
        listener(active);
      } catch {
        // Ignora
      }
    }
  }
}

/**
 * Permite que componentes assinem o estado de Cold Start do servidor (quando uma requisição leva > 2.5s)
 */
export function subscribeColdStart(listener: ColdStartListener): () => void {
  coldStartListeners.add(listener);
  listener(isCurrentlyColdStarting);
  return () => {
    coldStartListeners.delete(listener);
  };
}

export function isBackendColdStarting(): boolean {
  return isCurrentlyColdStarting;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly fieldErrors?: Record<string, string[] | undefined>;

  constructor(
    message: string,
    status: number,
    fieldErrors?: Record<string, string[] | undefined>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const authToken = token ?? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

  activeRequestsCount += 1;
  const coldStartTimer = window.setTimeout(() => {
    if (activeRequestsCount > 0) {
      setColdStartingState(true);
    }
  }, 2500);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        data?.message || 'Não foi possível completar a solicitação.',
        response.status,
        data?.errors
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Tratamento de falha de rede/cold start sem quebrar a UX offline
    throw new ApiError(
      'O servidor de apoio está despertando ou temporariamente indisponível. Fique tranquilo: seu refúgio offline está 100% ativo.',
      0
    );
  } finally {
    window.clearTimeout(coldStartTimer);
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    if (activeRequestsCount === 0) {
      setColdStartingState(false);
    }
  }
}

export const api = {
  getCaptcha: () => request<CaptchaChallenge>('/auth/captcha', { method: 'GET' }),

  register: (payload: {
    nome: string;
    email: string;
    senha: string;
    dataNascimento: string;
    captchaToken: string;
  }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; senha: string; captchaToken: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: (token?: string) =>
    request<{ user: AuthUser }>('/auth/me', {
      method: 'GET',
      token,
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { token: string; novaSenha: string }) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPreferences: () =>
    request<{ preferences: UserPreferences }>('/preferences', { method: 'GET' }),

  savePreferences: (payload: {
    nomeAmigo?: string;
    temaNoturno?: boolean;
    generosMusicais: string[];
    artistasPreferidos: string[];
    modoAleatorio: boolean;
    contatoEmergenciaNome?: string | null;
    contatoEmergenciaTelefone?: string | null;
  }) =>
    request<{ preferences: UserPreferences }>('/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updateFriendName: (nomeAmigo: string) =>
    request<{ preferences: UserPreferences }>('/preferences/friend-name', {
      method: 'PATCH',
      body: JSON.stringify({ nomeAmigo }),
    }),

  updateTheme: (temaNoturno: boolean) =>
    request<{ preferences: UserPreferences }>('/preferences/theme', {
      method: 'PATCH',
      body: JSON.stringify({ temaNoturno }),
    }),

  getBotTracks: () =>
    request<{ tracks: CuratedTrack[] }>('/bot/tracks', { method: 'GET' }),

  getChatHistory: (options?: { crisis?: boolean }) =>
    request<{ friendName: string; messages: ChatMessage[] }>(
      `/api/chat/history${options?.crisis ? '?crisis=true' : ''}`,
      { method: 'GET' }
    ),

  clearChatHistory: () =>
    request<{ friendName: string; message: ChatMessage }>('/api/chat/history', {
      method: 'DELETE',
    }),

  createCrisisWelcome: () =>
    request<{ friendName: string; message: ChatMessage }>('/api/chat/welcome', {
      method: 'POST',
    }),

  sendChatMessage: (payload: {
    tipo: ChatMessageType;
    conteudoTexto?: string;
    audioUrl?: string | null;
    audioDuration?: number | null;
    criseRelacionada?: boolean;
  }) =>
    request<{
      friendName: string;
      userMessage: ChatMessage;
      friendMessage: ChatMessage;
    }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  syncOfflineChat: (
    messages: Array<{
      tipo: ChatMessageType;
      conteudoTexto?: string;
      audioUrl?: string | null;
      audioDuration?: number | null;
      criseRelacionada?: boolean;
    }>
  ) =>
    request<{
      synced: Array<{ userMessage: ChatMessage; friendMessage: ChatMessage }>;
    }>('/api/chat/sync', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),

  getChatReportData: () =>
    request<{ report: ChatReportData }>('/api/chat/report-data', { method: 'GET' }),
};
