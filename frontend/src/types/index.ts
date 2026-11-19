export interface UserPreferences {
  id?: string;
  nomeAmigo?: string;
  temaNoturno?: boolean;
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

export type ChatSender = 'USER' | 'FRIEND';
export type ChatMessageType = 'TEXT' | 'AUDIO';

export interface ChatMessage {
  id: string;
  sessionId?: string | null;
  userId?: string;
  remetente: ChatSender;
  tipo: ChatMessageType;
  conteudoTexto: string;
  audioUrl?: string | null;
  audioDuration?: number | null;
  criseRelacionada: boolean;
  criadoEm: string;
  pendingSync?: boolean;
}

export interface DailyConversationReport {
  date: string;
  isoDate: string;
  crisisCount: number;
  detectedTriggers: string[];
  dailySynthesis: string;
  messages: Array<{
    id: string;
    remetente: ChatSender;
    tipo: ChatMessageType;
    conteudoTexto: string;
    audioDuration: number | null;
    criseRelacionada: boolean;
    criadoEm: string;
    horario: string;
  }>;
}

export interface PracticalCareSuggestions {
  filmes: string[];
  livros: string[];
  musicas: string[];
  exercicios: string[];
  caminhadas: string[];
}

export interface ChatReportData {
  generatedAt: string;
  userName: string;
  friendName: string;
  totalMessages: number;
  totalAudioMessages: number;
  totalCrisisMessages: number;
  totalPanicActivations: number;
  topTriggers: Array<{ label: string; occurrences: number; recommendation: string }>;
  practicalSuggestions?: PracticalCareSuggestions;
  overallConclusion: string;
  disclaimer: string;
  days: DailyConversationReport[];
}
