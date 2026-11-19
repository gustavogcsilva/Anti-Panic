export interface UserPreferences {
  generosMusicais: string[];
  artistasPreferidos: string[];
  modoAleatorio: boolean;
  contatoEmergenciaNome: string | null;
  contatoEmergenciaTelefone: string | null;
  hasPreferences?: boolean;
}

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  dataNascimento: string;
  hasPreferences: boolean;
  preferences: UserPreferences | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface CaptchaChallenge {
  question: string;
  challengeToken: string;
  expiresAt: number;
}

export interface CuratedTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  duration: number;
  coverUrl: string | null;
  genre: string;
  moodTag: 'happy' | 'uplifting' | 'calming' | 'relaxing';
}
