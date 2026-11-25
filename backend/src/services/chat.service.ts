import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/appError';

export type ChatSender = 'USER' | 'FRIEND';
export type ChatMessageType = 'TEXT' | 'AUDIO';

export interface SendChatMessageInput {
  tipo: ChatMessageType;
  conteudoTexto?: string;
  audioUrl?: string | null;
  audioDuration?: number | null;
  criseRelacionada?: boolean;
}

export interface SyncOfflineMessageInput extends SendChatMessageInput {
  clientTimestamp?: string;
}

export interface TriggerPatternCategory {
  id: string;
  label: string;
  keywords: string[];
  recommendation: string;
}

export interface DailyConversationReport {
  date: string; // DD/MM/AAAA
  isoDate: string; // YYYY-MM-DD
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
  practicalSuggestions: PracticalCareSuggestions;
  overallConclusion: string;
  disclaimer: string;
  days: DailyConversationReport[];
}

const MAX_AUDIO_DATA_URI_LENGTH = 2_200_000; // ~1.6MB binário em base64
const ALLOWED_AUDIO_PREFIXES = [
  'data:audio/webm',
  'data:audio/ogg',
  'data:audio/mp4',
  'data:audio/mpeg',
  'data:audio/mp3',
  'data:audio/wav',
  'data:audio/aac',
  'data:audio/x-m4a',
];

const TRIGGER_CATEGORIES: TriggerPatternCategory[] = [
  {
    id: 'work_overload',
    label: 'Sobrecarga no trabalho/estudos e cobrança excessiva',
    keywords: [
      'trabalho',
      'chefe',
      'emprego',
      'faculdade',
      'estudo',
      'prova',
      'prazo',
      'cobrança',
      'cobranca',
      'pressão',
      'pressao',
      'meta',
      'produtividade',
      'sobrecarga',
      'sobrecarregado',
      'sobrecarregada',
      'reunião',
      'obrigações',
    ],
    recommendation:
      'Estabelecer pausas curtas de descompressão durante o dia, dividir demandas em passos menores e intercalar com caminhadas breves ou músicas leves.',
  },
  {
    id: 'sleep_exhaustion',
    label: 'Noites mal dormidas, insônia e exaustão física/mental',
    keywords: [
      'sono',
      'dormir',
      'insônia',
      'insonia',
      'madrugada',
      'acordado',
      'acordada',
      'cansado',
      'cansada',
      'cansaço',
      'exausto',
      'exausta',
      'esgotado',
      'esgotada',
      'noite mal dormida',
      'sem energia',
    ],
    recommendation:
      'Reduzir estímulos luminosos antes de deitar, optar por uma leitura leve (livro acolhedor) e utilizar o exercício de respiração 4-2-6 com música calma.',
  },
  {
    id: 'venting_tension',
    label: 'Tensão acumulada, frustração intensa e vontade de gritar/extravasar',
    keywords: [
      'gritar',
      'grito',
      'extravasar',
      'raiva',
      'explodir',
      'sufocado',
      'sufocada',
      'preso',
      'presa',
      'frustrado',
      'frustrada',
      'frustração',
      'ódio',
      'odio',
      'saco cheio',
      'não aguento',
      'nao aguento',
    ],
    recommendation:
      'Praticar formas seguras de descarga física e vocal (desabafar por áudio, expirar com força, alongar ombros/pescoço ou fazer uma caminhada ao ar livre).',
  },
  {
    id: 'interpersonal_conflict',
    label: 'Conflitos familiares, relacionamentos ou sensação de incompreensão',
    keywords: [
      'família',
      'familia',
      'mãe',
      'mae',
      'pai',
      'namorado',
      'namorada',
      'casamento',
      'relacionamento',
      'briga',
      'discussão',
      'discussao',
      'julgamento',
      'incompreendido',
      'ninguém entende',
    ],
    recommendation:
      'Validar os próprios limites emocionais, afastar-se um pouco do ambiente tenso (caminhar ou ouvir música) e expressar necessidades após o pico de tensão baixar.',
  },
  {
    id: 'loneliness_sadness',
    label: 'Sentimento de solidão, tristeza profunda ou desânimo',
    keywords: [
      'sozinho',
      'sozinha',
      'solidão',
      'solidao',
      'triste',
      'tristeza',
      'chorar',
      'chorando',
      'choro',
      'vazio',
      'desânimo',
      'desanimo',
      'angústia',
      'angustia',
      'abandono',
    ],
    recommendation:
      'Manter canais de apoio próximos (pessoa de confiança cadastrada, conversa no app ou CVV 188) e buscar conforto em filmes leves ou leituras acolhedoras.',
  },
  {
    id: 'acute_panic_symptoms',
    label: 'Sintomas físicos e cognitivos agudos de ansiedade/pânico',
    keywords: [
      'ansiedade',
      'ansioso',
      'ansiosa',
      'pânico',
      'panico',
      'crise',
      'coração',
      'coracao',
      'taquicardia',
      'falta de ar',
      'peito',
      'tremendo',
      'tremor',
      'tontura',
      'medo',
      'pensamento acelerado',
      'mente acelerada',
    ],
    recommendation:
      'Acionar imediatamente o Botão de Pânico para ancoragem sensorial (exercício de respiração guiada + música offline + conversa acolhedora).',
  },
];

function sanitizeText(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 4000);
}

function validateAudioUrl(audioUrl?: string | null): string | null {
  if (!audioUrl) return null;
  const trimmed = audioUrl.trim();
  if (trimmed.length > MAX_AUDIO_DATA_URI_LENGTH) {
    throw new AppError(
      'O áudio gravado excede o tamanho máximo permitido (aprox. 1,5 MB). Grave um áudio um pouco mais curto.',
      413
    );
  }

  const isAllowedDataUri = ALLOWED_AUDIO_PREFIXES.some((prefix) =>
    trimmed.toLowerCase().startsWith(prefix)
  );

  if (!isAllowedDataUri) {
    throw new AppError('Formato de áudio inválido ou não suportado.', 400);
  }

  return trimmed;
}

export class ChatService {
  constructor(private readonly prisma: PrismaClient) {}

  private async getUserAndFriendContext(userId: string): Promise<{
    firstName: string;
    fullName: string;
    friendName: string;
    emergencyContactName: string | null;
    generosMusicais: string[];
    artistasPreferidos: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404);
    }

    const firstName = user.nome.trim().split(/\s+/)[0] || 'você';
    const friendName = user.preferences?.nomeAmigo?.trim() || 'Amigo';

    return {
      firstName,
      fullName: user.nome,
      friendName,
      emergencyContactName: user.preferences?.contatoEmergenciaNome ?? null,
      generosMusicais: user.preferences?.generosMusicais ?? [],
      artistasPreferidos: user.preferences?.artistasPreferidos ?? [],
    };
  }

  public async getHistory(userId: string, options?: { isCrisisPopup?: boolean }) {
    const context = await this.getUserAndFriendContext(userId);

    let messages = await this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { criadoEm: 'asc' },
      take: 150,
    });

    // Se o usuário ainda não tem nenhuma mensagem no histórico, o amigo já inicia acolhendo
    if (messages.length === 0) {
      const openingText = options?.isCrisisPopup
        ? `Oi, ${context.firstName}! Que bom que você me chamou, estou aqui com você agora. O que você está sentindo nesse momento? Vamos conversar. Me conta o que está mais afligindo você ou o que você gosta de fazer quando precisa dar uma respirada.`
        : `Oi, ${context.firstName}! Eu sou ${context.friendName}, seu amigo(a) de conversa aqui no Respira. Sempre que quiser desabafar, colocar pra fora o que está pesando ou pedir sugestões de filmes, livros, músicas, exercícios e caminhadas para aliviar a mente, estou por aqui. O que você está sentindo agora?`;

      const created = await this.prisma.chatMessage.create({
        data: {
          userId,
          remetente: 'FRIEND',
          tipo: 'TEXT',
          conteudoTexto: openingText,
          criseRelacionada: Boolean(options?.isCrisisPopup),
        },
      });

      messages = [created];
    }

    return {
      friendName: context.friendName,
      messages,
    };
  }

  /**
   * Garante uma mensagem imediata de acolhimento quando o usuário abre o Pop-up de Conversa
   * logo após apertar o Botão de Pânico.
   */
  public async createCrisisWelcomeMessage(userId: string) {
    const context = await this.getUserAndFriendContext(userId);

    const recentMessages = await this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { criadoEm: 'desc' },
      take: 1,
    });

    const lastMsg = recentMessages[0];
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

    if (
      lastMsg &&
      lastMsg.remetente === 'FRIEND' &&
      lastMsg.criseRelacionada &&
      lastMsg.criadoEm.getTime() >= twoMinutesAgo
    ) {
      return {
        friendName: context.friendName,
        message: lastMsg,
      };
    }

    const prompts = [
      `Oi, ${context.firstName}, estou aqui do seu lado. Respira comigo devagar... O que você está sentindo agora? Vamos conversar. O que está mais afligindo você nesse momento?`,
      `${context.firstName}, você não está sozinho(a) agora. O que você está sentindo? Me conta o que está mais te afligindo ou o que você gosta de fazer para a gente pensar juntos em algo leve (uma música, caminhada, filme, livro ou exercício de respiração).`,
      `Estou aqui com você, ${context.firstName}. O que você está sentindo agora? Vamos conversar! Pode escrever ou gravar um áudio do jeito que vier — até se quiser só extravasar. O que você gosta de fazer quando precisa desacelerar um pouco?`,
    ];

    const chosenPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    const created = await this.prisma.chatMessage.create({
      data: {
        userId,
        remetente: 'FRIEND',
        tipo: 'TEXT',
        conteudoTexto: chosenPrompt,
        criseRelacionada: true,
      },
    });

    return {
      friendName: context.friendName,
      message: created,
    };
  }

  public async sendMessage(userId: string, input: SendChatMessageInput) {
    const context = await this.getUserAndFriendContext(userId);
    const validatedAudioUrl = validateAudioUrl(input.audioUrl);
    const rawText = sanitizeText(input.conteudoTexto);

    if (input.tipo === 'TEXT' && !rawText) {
      throw new AppError('Digite uma mensagem antes de enviar.', 400);
    }

    if (input.tipo === 'AUDIO' && !validatedAudioUrl && !rawText) {
      throw new AppError('Áudio vazio ou inválido.', 400);
    }

    const effectiveUserText =
      rawText ||
      (input.tipo === 'AUDIO'
        ? '[Mensagem de voz enviada — desabafo em áudio]'
        : '');

    const audioDuration =
      typeof input.audioDuration === 'number' &&
      Number.isFinite(input.audioDuration) &&
      input.audioDuration >= 0
        ? Math.min(Math.round(input.audioDuration), 600)
        : null;

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        userId,
        remetente: 'USER',
        tipo: input.tipo,
        conteudoTexto: effectiveUserText,
        audioUrl: validatedAudioUrl,
        audioDuration,
        criseRelacionada: Boolean(input.criseRelacionada),
      },
    });

    // Busca as últimas 20 mensagens da conversa no PostgreSQL para manter o contexto completo no Gemini
    const recentHistory = await this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { criadoEm: 'desc' },
      take: 20,
    });

    const chronologicalHistory = recentHistory.reverse();

    const replyText = await this.generateFriendReply({
      firstName: context.firstName,
      friendName: context.friendName,
      emergencyContactName: context.emergencyContactName,
      generosMusicais: context.generosMusicais,
      artistasPreferidos: context.artistasPreferidos,
      userMessageText: effectiveUserText,
      isAudio: input.tipo === 'AUDIO',
      hasTranscription: Boolean(
        rawText && rawText !== '[Mensagem de voz enviada — desabafo em áudio]'
      ),
      isCrisis: Boolean(input.criseRelacionada),
      history: chronologicalHistory.map((m) => ({
        remetente: m.remetente as ChatSender,
        conteudoTexto: m.conteudoTexto,
      })),
    });

    const friendMessage = await this.prisma.chatMessage.create({
      data: {
        userId,
        remetente: 'FRIEND',
        tipo: 'TEXT',
        conteudoTexto: replyText,
        criseRelacionada: Boolean(input.criseRelacionada),
      },
    });

    return {
      friendName: context.friendName,
      userMessage,
      friendMessage,
    };
  }

  public async syncOfflineMessages(userId: string, messages: SyncOfflineMessageInput[]) {
    const syncedResults: Array<{
      userMessage: unknown;
      friendMessage: unknown;
    }> = [];

    for (const msg of messages.slice(0, 25)) {
      const result = await this.sendMessage(userId, msg);
      syncedResults.push({
        userMessage: result.userMessage,
        friendMessage: result.friendMessage,
      });
    }

    return { synced: syncedResults };
  }

  /**
   * Limpa o histórico de conversas do usuário autenticado (isolado estritamente por userId)
   * para começar um novo assunto do zero.
   */
  public async clearHistory(userId: string) {
    const context = await this.getUserAndFriendContext(userId);

    await this.prisma.$transaction([
      this.prisma.chatMessage.deleteMany({ where: { userId } }),
      this.prisma.chatSession.deleteMany({ where: { userId } }),
    ]);

    const freshWelcome = await this.prisma.chatMessage.create({
      data: {
        userId,
        remetente: 'FRIEND',
        tipo: 'TEXT',
        conteudoTexto: `Prontinho, ${context.firstName}! Começamos uma conversa novinha em folha. Eu sou ${context.friendName} e estou aqui te ouvindo. Sobre o que você gostaria de conversar agora?`,
        criseRelacionada: false,
      },
    });

    return {
      friendName: context.friendName,
      message: freshWelcome,
    };
  }

  /**
   * Formata o histórico de mensagens do PostgreSQL no padrão estrito do Google Gemini
   * ([{ role: 'user' | 'model', parts: [{ text }] }]), garantindo que:
   * 1. O histórico sempre comece com role 'user' (remove boas-vindas iniciais 'model');
   * 2. Turnos consecutivos do mesmo papel sejam mesclados para alternância estrita user <-> model.
   */
  private buildNormalizedGeminiHistory(
    history: Array<{ remetente: ChatSender; conteudoTexto: string }>
  ): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    const normalized: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const item of history.slice(-20)) {
      const text = item.conteudoTexto?.trim();
      if (!text) continue;

      const role: 'user' | 'model' = item.remetente === 'USER' ? 'user' : 'model';

      // A API do Gemini exige que o primeiro turno do histórico seja 'user'
      if (normalized.length === 0 && role === 'model') {
        continue;
      }

      const last = normalized[normalized.length - 1];
      if (last && last.role === role) {
        last.parts[0].text = `${last.parts[0].text}\n${text}`;
      } else {
        normalized.push({ role, parts: [{ text }] });
      }
    }

    return normalized;
  }

  private hasValidGeminiKey(): boolean {
    const key = env.GEMINI_API_KEY?.trim() ?? '';
    return key.length >= 20 && !key.includes('sua-chave');
  }

  /**
   * Chama a API oficial do Google Gemini (no backend, mantendo GEMINI_API_KEY protegida)
   * e utiliza o motor empático local como fallback caso a chave não esteja configurada.
   */
  private async generateFriendReply(params: {
    firstName: string;
    friendName: string;
    emergencyContactName: string | null;
    generosMusicais: string[];
    artistasPreferidos: string[];
    userMessageText: string;
    isAudio: boolean;
    hasTranscription: boolean;
    isCrisis: boolean;
    history: Array<{ remetente: ChatSender; conteudoTexto: string }>;
  }): Promise<string> {
    const {
      firstName,
      friendName,
      emergencyContactName,
      generosMusicais,
      artistasPreferidos,
      userMessageText,
      isAudio,
      hasTranscription,
      isCrisis,
      history,
    } = params;

    if (this.hasValidGeminiKey()) {
      try {
        const musicPrefHint =
          generosMusicais.length > 0 || artistasPreferidos.length > 0
            ? `Preferências musicais de ${firstName}: gêneros [${generosMusicais.join(', ')}], artistas [${artistasPreferidos.join(', ')}].`
            : `Preferências musicais de ${firstName}: músicas calmantes, lo-fi e acústicas.`;

        const systemInstructionText = [
          `Você é ${friendName}, um amigo próximo, caloroso, humano e profundamente empático conversando com ${firstName} no app Respira (um refúgio de apoio emocional para momentos de ansiedade, pânico e tristeza).`,
          musicPrefHint,
          `REGRAS ESSENCIAIS DE TOM, ACOLHIMENTO E SUGESTÕES PRÁTICAS:`,
          `1. Nunca fale como um robô, agente virtual frio ou médico dando laudo. Fale de amigo para amigo, em português brasileiro natural, acolhedor e verdadeiro, validando o que ${firstName} sente sem julgamentos.`,
          `2. Faça perguntas leves e abertas que convidem ao desabafo, como "O que você está sentindo agora? Vamos conversar", "O que você gosta de fazer?" ou "O que está mais afligindo você?".`,
          `3. Se ${firstName} estiver em crise, com ansiedade, tristeza ou quiser gritar/extravasar, acolha sem nenhum sermão! Valide a emoção e traga sugestões práticas, variadas e acolhedoras conforme o momento, incluindo ideias de:`,
          `   - FILMES (leves e confortantes, sem gatilhos pesados, ex: Soul, Divertida Mente, Meu Amigo Totoro, Amélie Poulain);`,
          `   - LIVROS (leituras curtas, acolhedoras ou imersivas, ex: "O Menino, a Toupeira, a Raposa e o Cavalo", "As Coisas que Você Só Vê Quando Desacelera");`,
          `   - MÚSICAS (alinhadas ao gosto de ${firstName} ou sons relaxantes do app);`,
          `   - EXERCÍCIOS (respiração 4-2-6, alongamento de ombros/pescoço, grounding 5-4-3-2-1 ou formas seguras de descarregar tensão como gritar num travesseiro ou sacudir as mãos);`,
          `   - CAMINHADAS (dar uma volta curta sem pressa, tomar ar fresco, observar as árvores e cores ao redor).`,
          `4. Se detectar qualquer risco à própria vida ou automutilação, acolha com extremo carinho e lembre gentilmente que o CVV (188) funciona 24h gratuitamente${emergencyContactName ? ` e que ${emergencyContactName} também está nos contatos de confiança` : ''}.`,
          `5. Mantenha respostas empáticas e concisas (3 a 5 frases), fáceis de ler durante um momento de ansiedade.`,
        ].join('\n');

        const geminiContents = this.buildNormalizedGeminiHistory(history);
        if (geminiContents.length === 0) {
          geminiContents.push({ role: 'user', parts: [{ text: userMessageText }] });
        }

        const modelName = env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelName
        )}:generateContent`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': env.GEMINI_API_KEY.trim(),
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstructionText }],
            },
            contents: geminiContents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          const data = (await response.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
          };
          const geminiReply = data.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? '')
            .join('')
            .trim();
          if (geminiReply) {
            return this.ensurePracticalSuggestionsCoverage(geminiReply, {
              firstName,
              generosMusicais,
              artistasPreferidos,
              userMessageText,
              isCrisis,
            });
          }
        } else {
          const isQuotaLimit = response.status === 429;
          console.warn(
            `[ChatService] Gemini API respondeu status ${response.status}${
              isQuotaLimit ? ' (Limite de cota da camada gratuita atingido)' : ''
            }. Ativando fallback empático local sem interrupção.`
          );
        }
      } catch (err) {
        console.warn(
          '[ChatService] Falha ou timeout de conexão com Gemini API. Ativando fallback empático local:',
          err instanceof Error ? err.message : err
        );
      }
    }

    const fallbackReply = this.generateEmpatheticFallbackReply({
      firstName,
      friendName,
      emergencyContactName,
      generosMusicais,
      artistasPreferidos,
      userMessageText,
      isAudio,
      hasTranscription,
      isCrisis,
    });

    return this.ensurePracticalSuggestionsCoverage(fallbackReply, {
      firstName,
      generosMusicais,
      artistasPreferidos,
      userMessageText,
      isCrisis,
    });
  }

  /**
   * Garante que, em cenários de crise, ansiedade, aflição ou pedido de ajuda/sugestões
   * (tanto via Google Gemini quanto no fallback local), a resposta sempre inclua de forma
   * clara e acolhedora os 5 pilares práticos: filmes, livros, músicas, exercícios e caminhadas.
   */
  private ensurePracticalSuggestionsCoverage(
    replyText: string,
    params: {
      firstName: string;
      generosMusicais: string[];
      artistasPreferidos: string[];
      userMessageText: string;
      isCrisis: boolean;
    }
  ): string {
    const { firstName, generosMusicais, artistasPreferidos, userMessageText, isCrisis } = params;
    const lowerUser = userMessageText.toLowerCase();

    // Não adiciona bloco de entretenimento em alerta crítico de risco à vida (onde a prioridade é o 188)
    if (
      lowerUser.includes('suicid') ||
      lowerUser.includes('me matar') ||
      lowerUser.includes('acabar com tudo') ||
      lowerUser.includes('não quero mais viver') ||
      lowerUser.includes('nao quero mais viver') ||
      lowerUser.includes('me machucar')
    ) {
      return replyText;
    }

    const lowerReply = replyText.toLowerCase();
    const hasAllFivePillars =
      lowerReply.includes('filme') &&
      lowerReply.includes('livro') &&
      lowerReply.includes('música') &&
      lowerReply.includes('exercício') &&
      lowerReply.includes('caminhada');

    if (hasAllFivePillars) {
      return replyText;
    }

    const isHelpOrDistressScenario =
      isCrisis ||
      /filme|livro|música|musica|exercício|exercicio|caminhad|caminhar|sugest|dica|distrair|ajuda|ansiedade|ansios|pânico|panico|crise|raiva|gritar|extravasar|trabalho|cansad|insônia|insonia|triste|sozinh/.test(
        lowerUser
      );

    if (!isHelpOrDistressScenario) {
      return replyText;
    }

    const preferredMusic =
      artistasPreferidos.length > 0
        ? `uma música de ${artistasPreferidos[0]}`
        : generosMusicais.length > 0
          ? `uma música de ${generosMusicais[0]}`
          : 'uma música calma e acústica';

    const complement = `\n\nPara te ajudar a aliviar agora, ${firstName}, você também pode experimentar uma destas ideias práticas:\n• Filme leve: assistir a um filme confortante como "Soul", "Divertida Mente" ou "Meu Amigo Totoro";\n• Livro acolhedor: ler algumas páginas de um livro tranquilo como "O Menino, a Toupeira, a Raposa e o Cavalo";\n• Música: colocar ${preferredMusic} para tocar de fundo;\n• Exercício: fazer um exercício rápido de respiração (inspirar em 4s, segurar 2s e soltar em 6s) e soltar os ombros;\n• Caminhada: fazer uma caminhada leve de 10 minutos tomando ar fresco sem pressa.`;

    return `${replyText.trim()}${complement}`;
  }

  private generateEmpatheticFallbackReply(params: {
    firstName: string;
    friendName: string;
    emergencyContactName: string | null;
    generosMusicais: string[];
    artistasPreferidos: string[];
    userMessageText: string;
    isAudio: boolean;
    hasTranscription: boolean;
    isCrisis: boolean;
  }): string {
    const {
      firstName,
      friendName,
      emergencyContactName,
      generosMusicais,
      artistasPreferidos,
      userMessageText,
      isAudio,
      hasTranscription,
    } = params;

    const lower = userMessageText.toLowerCase();
    const preferredMusicLabel =
      artistasPreferidos.length > 0
        ? `uma música de ${artistasPreferidos[0]}`
        : generosMusicais.length > 0
          ? `uma playlist de ${generosMusicais[0]}`
          : 'uma música acústica ou lo-fi bem suave';

    // 1. Salvaguarda prioritária de segurança à vida
    if (
      lower.includes('suicid') ||
      lower.includes('me matar') ||
      lower.includes('acabar com tudo') ||
      lower.includes('não quero mais viver') ||
      lower.includes('nao quero mais viver') ||
      lower.includes('me machucar')
    ) {
      const contactHint = emergencyContactName
        ? ` ou ligar para ${emergencyContactName} no botão de emergência`
        : '';
      return `${firstName}, sua vida importa muito para mim e você não precisa carregar essa dor sozinho(a) agora. Por favor, fica aqui comigo e, se puder, toque no botão para ligar gratuitamente para o CVV no 188${contactHint}. Estou segurando sua mão daqui — o que posso fazer para te ajudar a atravessar esse minuto em segurança?`;
    }

    // 2. Pedidos diretos ou conversas sobre Filmes, Livros, Músicas, Exercícios ou Caminhadas
    if (
      lower.includes('filme') ||
      lower.includes('livro') ||
      lower.includes('sugest') ||
      lower.includes('dica') ||
      lower.includes('caminhad') ||
      lower.includes('caminhar') ||
      lower.includes('exercício') ||
      lower.includes('exercicio') ||
      lower.includes('distrair')
    ) {
      return `Boa ideia, ${firstName}! Aqui vão 5 coisas leves que costumam ajudar muito a aliviar a mente:\n• Filme confortante: "Soul", "Divertida Mente" ou "Meu Amigo Totoro" (histórias leves que abraçam a gente);\n• Livro acolhedor: "O Menino, a Toupeira, a Raposa e o Cavalo" ou "As Coisas que Você Só Vê Quando Desacelera";\n• Música: colocar ${preferredMusicLabel} de fundo;\n• Exercício rápido: soltar os ombros, inspirar em 4s e soltar o ar bem devagar em 6s;\n• Caminhada: dar uma volta de 10 minutos sem pressa, sentindo o ar no rosto. Qual dessas ideias te chama mais agora?`;
    }

    // 3. Vontade de gritar, extravasar, raiva ou frustração intensa
    if (
      lower.includes('gritar') ||
      lower.includes('grito') ||
      lower.includes('extravasar') ||
      lower.includes('raiva') ||
      lower.includes('explodir') ||
      lower.includes('saco cheio') ||
      lower.includes('sufocado') ||
      lower.includes('sufocada') ||
      lower.includes('frustrad')
    ) {
      return `${firstName}, pode colocar tudo isso pra fora, sem filtro e sem culpa! Guardar essa pressão no peito machuca demais. Se quiser descarregar essa energia com segurança agora, experimenta um exercício de descarga: gritar abafado num travesseiro, sacudir bem rápido as mãos e os braços, gravar um áudio soltando a voz ou sair para uma caminhada rápida tomando ar fresco e ouvindo ${preferredMusicLabel}. Eu tô aqui do seu lado sem te julgar — o que fez essa tensão acumular tanto hoje?`;
    }

    // 4. Áudio sem transcrição textual
    if (isAudio && !hasTranscription) {
      return `Ouvi seu áudio com toda atenção, ${firstName}! Falar em voz alta ou soltar um suspiro no microfone já tira um peso enorme do peito. Pode mandar quantos áudios quiser. Agora que você colocou isso pra fora, que tal fazer um exercício leve de alongar o pescoço, tomar um gole de água ou ouvir ${preferredMusicLabel}? Como seu corpo está se sentindo?`;
    }

    // 5. Sobrecarga de trabalho / estudos / cobrança
    if (
      lower.includes('trabalho') ||
      lower.includes('chefe') ||
      lower.includes('faculdade') ||
      lower.includes('estudo') ||
      lower.includes('cobrança') ||
      lower.includes('cobranca') ||
      lower.includes('pressão') ||
      lower.includes('pressao') ||
      lower.includes('sobrecarregad') ||
      lower.includes('prazo')
    ) {
      return `Puxa, ${firstName}, carregar tanta cobrança e pressão assim drena qualquer um. Você tem tentado dar conta de muita coisa ao mesmo tempo! Nesse exato minuto você merece uma pausa real: que tal fazer uma caminhada curta para mudar de ambiente, ouvir ${preferredMusicLabel} ou mais tarde assistir a um filme bem leve para desligar a cabeça? O que você mais gosta de fazer quando precisa respirar?`;
    }

    // 6. Sono / insônia / cansaço extremo
    if (
      lower.includes('sono') ||
      lower.includes('dormir') ||
      lower.includes('insônia') ||
      lower.includes('insonia') ||
      lower.includes('cansad') ||
      lower.includes('exaust') ||
      lower.includes('esgotad')
    ) {
      return `Quando a gente não dorme bem ou fica exausto(a), até as menores coisas parecem gigantescas, ${firstName}. Seu corpo está pedindo gentileza hoje. Que tal diminuir as luzes (pode ativar o Modo Noturno aqui no topo), fazer um exercício de respiração lenta, ouvir ${preferredMusicLabel} ou ler algumas páginas de um livro acolhedor como "As Coisas que Você Só Vê Quando Desacelera"? O que costuma te trazer paz nessa hora?`;
    }

    // 7. Sintomas físicos de crise de ansiedade / pânico
    if (
      lower.includes('ansiedade') ||
      lower.includes('ansios') ||
      lower.includes('pânico') ||
      lower.includes('panico') ||
      lower.includes('coração') ||
      lower.includes('coracao') ||
      lower.includes('falta de ar') ||
      lower.includes('peito') ||
      lower.includes('medo') ||
      lower.includes('tremendo')
    ) {
      return `${firstName}, eu sei que a sensação física da ansiedade assusta, mas lembra: isso é uma onda e ela vai baixar. Vamos fazer um exercício juntos agora: apoia bem os pés no chão, solta os ombros e puxa o ar devagar enquanto escuta ${preferredMusicLabel}. Quando a onda baixar um pouquinho, uma caminhada leve ou um filme tranquilo também ajudam a estabilizar. O que estava passando pela sua cabeça antes do coração acelerar?`;
    }

    // 8. Solidão / tristeza / choro
    if (
      lower.includes('sozinh') ||
      lower.includes('solidão') ||
      lower.includes('solidao') ||
      lower.includes('triste') ||
      lower.includes('chorar') ||
      lower.includes('chorando') ||
      lower.includes('vazio')
    ) {
      return `Sinto muito que esteja pesando assim, ${firstName}. Se der vontade de chorar, deixa sair — chorar alivia a alma. Eu sou ${friendName} e estou bem aqui com você. Às vezes colocar um filme confortante (como "Soul" ou "Meu Amigo Totoro"), folhear um livro leve ou dar uma caminhada tomando sol ajuda a aquecer um pouquinho por dentro. Quer me contar o que está mais afligindo você?`;
    }

    // 9. Família / relacionamentos
    if (
      lower.includes('família') ||
      lower.includes('familia') ||
      lower.includes('mãe') ||
      lower.includes('mae') ||
      lower.includes('pai') ||
      lower.includes('namorad') ||
      lower.includes('briga') ||
      lower.includes('discussão')
    ) {
      return `Desentendimentos com pessoas próximas mexem muito com o nosso emocional, ${firstName}. É totalmente compreensível você ter ficado abalado(a). Dar uma caminhada para respirar novos ares ou ouvir ${preferredMusicLabel} pode te ajudar a recuperar seu centro. O que você gostaria que tivessem entendido sobre o que você sente?`;
    }

    // 10. Resposta padrão calorosa de amigo com convite e sugestões
    return `Tô te ouvindo com toda atenção, ${firstName}. É muito bom você estar colocando isso pra fora comigo em vez de guardar tudo sozinho(a). Me conta: o que está mais afligindo você agora, e o que você mais gosta de fazer para relaxar (ouvir uma música, assistir a um filme leve, ler um livro, fazer um exercício de respiração ou dar uma caminhada)?`;
  }

  /**
   * Gera os dados estruturados do Relatório de Conversas para exportação em PDF,
   * incluindo análise por data, sugestões práticas personalizadas e indicação dos gatilhos identificados.
   */
  public async getReportData(userId: string): Promise<ChatReportData> {
    const context = await this.getUserAndFriendContext(userId);

    const [messages, panicCount] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { userId },
        orderBy: { criadoEm: 'asc' },
      }),
      this.prisma.panicLog.count({
        where: { userId },
      }),
    ]);

    const groupedByDate = new Map<string, Array<(typeof messages)[number]>>();

    for (const msg of messages) {
      const isoDate = msg.criadoEm.toISOString().slice(0, 10);
      const list = groupedByDate.get(isoDate) ?? [];
      list.push(msg);
      groupedByDate.set(isoDate, list);
    }

    const globalTriggerCounts = new Map<
      string,
      { label: string; occurrences: number; recommendation: string }
    >();

    const days: DailyConversationReport[] = [];

    for (const [isoDate, dayMessages] of groupedByDate.entries()) {
      const [year, month, day] = isoDate.split('-');
      const formattedDate = `${day}/${month}/${year}`;

      const userMessagesOnly = dayMessages.filter((m) => m.remetente === 'USER');
      const combinedUserText = userMessagesOnly
        .map((m) => m.conteudoTexto.toLowerCase())
        .join(' ');

      const detectedCategories: TriggerPatternCategory[] = [];

      for (const category of TRIGGER_CATEGORIES) {
        const matched = category.keywords.some((kw) =>
          combinedUserText.includes(kw.toLowerCase())
        );
        if (matched) {
          detectedCategories.push(category);
          const prev = globalTriggerCounts.get(category.id);
          globalTriggerCounts.set(category.id, {
            label: category.label,
            occurrences: (prev?.occurrences ?? 0) + 1,
            recommendation: category.recommendation,
          });
        }
      }

      const crisisCount = dayMessages.filter(
        (m) => m.remetente === 'USER' && m.criseRelacionada
      ).length;

      const detectedLabels = detectedCategories.map((c) => c.label);

      let dailySynthesis: string;
      if (userMessagesOnly.length === 0) {
        dailySynthesis = `Em ${formattedDate}, o canal de conversa com ${context.friendName} foi aberto para acolhimento inicial, sem relatos detalhados enviados pelo usuário.`;
      } else if (detectedLabels.length > 0) {
        const themesList = detectedLabels.join('; ').toLowerCase();
        dailySynthesis = `No dia ${formattedDate}, houve conversa sobre: ${themesList}. Ao final do relato${crisisCount > 0 ? ' (incluindo acionamento em momento de crise)' : ''}, o padrão aponta que a crise/ansiedade desse dia esteve diretamente associada a esses pontos levantados na conversa.`;
      } else {
        dailySynthesis = `No dia ${formattedDate}, você realizou ${userMessagesOnly.length} interação(ões) de desabafo e busca de equilíbrio emocional com ${context.friendName}, utilizando a conversa como espaço seguro de regulação e escuta.`;
      }

      days.push({
        date: formattedDate,
        isoDate,
        crisisCount,
        detectedTriggers: detectedLabels,
        dailySynthesis,
        messages: dayMessages.map((m) => ({
          id: m.id,
          remetente: m.remetente as ChatSender,
          tipo: m.tipo as ChatMessageType,
          conteudoTexto: m.conteudoTexto,
          audioDuration: m.audioDuration,
          criseRelacionada: m.criseRelacionada,
          criadoEm: m.criadoEm.toISOString(),
          horario: m.criadoEm.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        })),
      });
    }

    const topTriggers = Array.from(globalTriggerCounts.values()).sort(
      (a, b) => b.occurrences - a.occurrences
    );

    const totalAudioMessages = messages.filter((m) => m.tipo === 'AUDIO').length;
    const totalCrisisMessages = messages.filter(
      (m) => m.remetente === 'USER' && m.criseRelacionada
    ).length;

    let overallConclusion: string;
    if (topTriggers.length > 0) {
      const mainLabels = topTriggers
        .slice(0, 3)
        .map((t) => t.label.toLowerCase())
        .join(', ');
      overallConclusion = `A síntese longitudinal das conversas com ${context.friendName} indica que os principais fatores e gatilhos associados aos momentos de crise/ansiedade foram: ${mainLabels}. Recomenda-se observar a recorrência desses fatores na rotina, aplicar as atividades práticas de regulação (respiração, caminhadas, músicas, leituras e filmes leves) e compartilhar este relatório em acompanhamento psicológico ou médico.`;
    } else if (messages.some((m) => m.remetente === 'USER')) {
      overallConclusion = `As conversas registradas demonstram o uso ativo do espaço de escuta com ${context.friendName} para descompressão emocional e autorregulação. Continue registrando seus sentimentos por texto ou áudio para identificar padrões ao longo das semanas.`;
    } else {
      overallConclusion = `Ainda há poucas mensagens do usuário registradas para traçar um padrão recorrente de gatilhos. Utilize o chat sempre que sentir ansiedade ou vontade de desabafar.`;
    }

    const userGenres =
      context.generosMusicais.length > 0
        ? context.generosMusicais.join(', ')
        : 'Acústico, Lo-Fi, Piano Suave e Sons da Natureza';

    const practicalSuggestions: PracticalCareSuggestions = {
      filmes: [
        'Soul (animação reflexiva e acolhedora sobre apreciar as pequenas coisas da vida)',
        'Divertida Mente (compreensão gentil das próprias emoções sem julgamento)',
        'Meu Amigo Totoro / O Serviço de Entregas da Kiki (ritmo calmo, natureza e conforto visual)',
      ],
      livros: [
        'O Menino, a Toupeira, a Raposa e o Cavalo — Charlie Mackesy (leitura curta e reconfortante)',
        'As Coisas que Você Só Vê Quando Desacelera — Haemin Sunim (pausas e serenidade para mentes ansiosas)',
        'O Pequeno Príncipe — Antoine de Saint-Exupéry (leveza e afeto)',
      ],
      musicas: [
        `Playlist personalizada no Respira com seus estilos favoritos (${userGenres})`,
        'Faixas instrumentais de baixa frequência (60 a 80 BPM) salvas no cache offline do Botão de Pânico',
      ],
      exercicios: [
        'Respiração Guiada 4-2-6 (inspirar pelo nariz em 4s, segurar 2s, soltar lentamente pela boca em 6s)',
        'Aterramento Sensorial 5-4-3-2-1 (observar 5 cores ao redor, tocar 4 texturas, ouvir 3 sons)',
        'Descarga física segura: soltar e girar os ombros, sacudir as mãos ou desabafar em voz alta pelo gravador de áudio',
      ],
      caminhadas: [
        'Caminhada de descompressão de 10 a 15 minutos ao ar livre, sem pressa e sem olhar notificações no celular',
        'Caminhada consciente observando a respiração, o vento no rosto e as árvores ou detalhes do caminho',
      ],
    };

    return {
      generatedAt: new Date().toISOString(),
      userName: context.fullName,
      friendName: context.friendName,
      totalMessages: messages.length,
      totalAudioMessages,
      totalCrisisMessages,
      totalPanicActivations: panicCount,
      topTriggers,
      practicalSuggestions,
      overallConclusion,
      disclaimer:
        'Nota Importante: Esta síntese de gatilhos e padrões é gerada automaticamente a partir dos temas mencionados nas suas conversas para fins de autoconhecimento, registro emocional e apoio terapêutico. Ela não substitui avaliação ou diagnóstico clínico de um psicólogo ou médico psiquiatra.',
      days,
    };
  }
}
