import type {
  AuthResponse,
  AuthUser,
  CaptchaChallenge,
  CuratedTrack,
  UserPreferences,
} from '../types';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3333';

export const AUTH_TOKEN_STORAGE_KEY = 'respira_auth_token';

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

  getBotTracks: () =>
    request<{ tracks: CuratedTrack[] }>('/bot/tracks', { method: 'GET' }),
};
