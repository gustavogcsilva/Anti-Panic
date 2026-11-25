import {
  AlertTriangle,
  Check,
  Clock,
  CloudOff,
  FileDown,
  HeartHandshake,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import {
  buildOfflineFriendReply,
  buildOfflineReportFromMessages,
  clearOfflineOutbox,
  enqueueOfflineMessage,
  getCachedMessages,
  getOfflineOutbox,
  saveCachedMessages,
} from '../../services/chatOfflineStore';
import { generateAndDownloadChatReportPdf } from '../../services/pdfReportGenerator';
import type { ChatMessage } from '../../types';
import { ThemeToggleButton } from '../theme/ThemeToggleButton';
import { AudioMessageBubble } from './AudioMessageBubble';
import { AudioRecorderBar } from './AudioRecorderBar';

interface FriendChatPanelProps {
  /** Indica se o chat foi aberto pelo Pop-up imediato do Botão de Pânico */
  isCrisisPopup?: boolean;
  /** Callback para fechar o modal quando usado como pop-up */
  onClose?: () => void;
}

const SUGGESTED_FRIEND_NAMES = ['Léo', 'Bia', 'Rafa', 'Nina', 'Dani', 'Caio'];

const QUICK_STARTER_PROMPTS = [
  'Estou sentindo muita ansiedade agora',
  'Me sugere filmes, livros, músicas, exercícios ou uma caminhada',
  'Quero gritar e extravasar toda essa tensão',
  'Estou sobrecarregado(a) no trabalho e dormindo mal',
];

export function FriendChatPanel({
  isCrisisPopup = false,
  onClose,
}: FriendChatPanelProps) {
  const { user, updateLocalPreferences } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const firstName = user?.nome?.split(' ')[0] ?? 'você';

  const [friendName, setFriendName] = useState<string>(
    user?.preferences?.nomeAmigo?.trim() || 'Amigo'
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftFriendName, setDraftFriendName] = useState(friendName);
  const [isSavingName, setIsSavingName] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [tokenWarning, setTokenWarning] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    if (user?.preferences?.nomeAmigo) {
      setFriendName(user.preferences.nomeAmigo);
      setDraftFriendName(user.preferences.nomeAmigo);
    }
  }, [user?.preferences?.nomeAmigo]);

  // Monitora conectividade online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Carrega histórico persistido no PostgreSQL (GET /api/chat/history) ou IndexedDB offline
  const loadConversation = useCallback(async () => {
    setIsLoadingHistory(true);
    setErrorBanner(null);

    const cached = await getCachedMessages(userId);
    if (cached.length > 0) {
      setMessages(cached);
    }

    if (!navigator.onLine) {
      if (cached.length === 0) {
        const offlineOpening: ChatMessage = {
          id: `offline-welcome-${Date.now()}`,
          remetente: 'FRIEND',
          tipo: 'TEXT',
          conteudoTexto: `Oi, ${firstName}! Mesmo sem internet agora, estou aqui com você. O que você está sentindo nesse momento? Vamos conversar.`,
          criseRelacionada: isCrisisPopup,
          criadoEm: new Date().toISOString(),
        };
        setMessages([offlineOpening]);
        await saveCachedMessages(userId, [offlineOpening]);
      }
      setIsLoadingHistory(false);
      return;
    }

    try {
      const historyResp = await api.getChatHistory({ crisis: isCrisisPopup });
      let nextMessages = historyResp.messages;
      setFriendName(historyResp.friendName || 'Amigo');
      setDraftFriendName(historyResp.friendName || 'Amigo');
      setTokenWarning(historyResp.tokenWarning ?? null);

      if (isCrisisPopup) {
        try {
          const welcomeResp = await api.createCrisisWelcome();
          const alreadyExists = nextMessages.some((m) => m.id === welcomeResp.message.id);
          if (!alreadyExists) {
            nextMessages = [...nextMessages, welcomeResp.message];
          }
        } catch {
          // Mantém histórico já carregado
        }
      }

      setMessages(nextMessages);
      await saveCachedMessages(userId, nextMessages);
    } catch {
      if (cached.length === 0) {
        const fallbackOpening: ChatMessage = {
          id: `local-welcome-${Date.now()}`,
          remetente: 'FRIEND',
          tipo: 'TEXT',
          conteudoTexto: `Oi, ${firstName}! Estou aqui com você. O que você está sentindo agora? Vamos conversar.`,
          criseRelacionada: isCrisisPopup,
          criadoEm: new Date().toISOString(),
        };
        setMessages([fallbackOpening]);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, [firstName, isCrisisPopup, userId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  // Scroll automático sempre que o histórico é carregado ou uma nova mensagem chega
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const handleClearHistory = async () => {
    if (isClearingHistory) return;
    const confirmed = window.confirm(
      'Deseja apagar toda a conversa e começar um assunto completamente novo do zero?'
    );
    if (!confirmed) return;

    setIsClearingHistory(true);
    setErrorBanner(null);

    try {
      await clearOfflineOutbox(userId);
      if (navigator.onLine) {
        await api.clearChatHistory();
      }
      setMessages([]);
      setTokenWarning(null);
      await saveCachedMessages(userId, []);
      setStatusToast('Conversa apagada! Pode começar um novo assunto do zero.');
      window.setTimeout(() => setStatusToast(null), 3500);
    } catch {
      setErrorBanner('Não foi possível apagar a conversa agora. Tente novamente.');
    } finally {
      setIsClearingHistory(false);
    }
  };

  // Sincroniza fila offline (IndexedDB outbox) automaticamente quando a internet volta
  useEffect(() => {
    if (!isOnline) return;

    let cancelled = false;
    const syncPending = async () => {
      const outbox = await getOfflineOutbox(userId);
      if (outbox.length === 0 || cancelled) return;

      try {
        await api.syncOfflineChat(
          outbox.map((item) => ({
            tipo: item.tipo,
            conteudoTexto: item.conteudoTexto,
            audioUrl: item.audioUrl,
            audioDuration: item.audioDuration,
            criseRelacionada: item.criseRelacionada,
          }))
        );
        await clearOfflineOutbox(userId);
        const refreshed = await api.getChatHistory();
        if (!cancelled) {
          setMessages(refreshed.messages);
          await saveCachedMessages(userId, refreshed.messages);
          setStatusToast('Mensagens offline sincronizadas com sucesso!');
          window.setTimeout(() => setStatusToast(null), 3500);
        }
      } catch {
        // Tentará novamente na próxima reconexão
      }
    };

    void syncPending();
    return () => {
      cancelled = true;
    };
  }, [isOnline, userId]);

  const handleSaveFriendName = async (event?: FormEvent) => {
    event?.preventDefault();
    const cleaned = draftFriendName.trim();
    if (cleaned.length < 2) {
      setErrorBanner('Escolha um nome com pelo menos 2 letras para seu amigo(a).');
      return;
    }

    setIsSavingName(true);
    setErrorBanner(null);

    try {
      setFriendName(cleaned);
      setIsEditingName(false);

      if (navigator.onLine) {
        const { preferences } = await api.updateFriendName(cleaned);
        updateLocalPreferences(preferences);
      } else if (user?.preferences) {
        updateLocalPreferences({
          ...user.preferences,
          nomeAmigo: cleaned,
        });
      }

      setStatusToast(`Agora você está conversando com ${cleaned}!`);
      window.setTimeout(() => setStatusToast(null), 3000);
    } catch {
      setErrorBanner('Não foi possível salvar o nome agora, mas já atualizamos na conversa.');
    } finally {
      setIsSavingName(false);
    }
  };

  const dispatchMessage = async (params: {
    tipo: 'TEXT' | 'AUDIO';
    conteudoTexto: string;
    audioUrl?: string | null;
    audioDuration?: number | null;
  }) => {
    const { tipo, conteudoTexto, audioUrl, audioDuration } = params;
    setErrorBanner(null);
    setIsSending(true);

    const optimisticUserMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      remetente: 'USER',
      tipo,
      conteudoTexto:
        conteudoTexto ||
        (tipo === 'AUDIO' ? '[Mensagem de voz enviada — desabafo em áudio]' : ''),
      audioUrl: audioUrl ?? null,
      audioDuration: audioDuration ?? null,
      criseRelacionada: isCrisisPopup,
      criadoEm: new Date().toISOString(),
      pendingSync: !navigator.onLine,
    };

    const withOptimistic = [...messages, optimisticUserMsg];
    setMessages(withOptimistic);
    scrollToBottom();

    if (!navigator.onLine) {
      await enqueueOfflineMessage({
        localId: optimisticUserMsg.id,
        userId,
        tipo,
        conteudoTexto: optimisticUserMsg.conteudoTexto,
        audioUrl: audioUrl ?? null,
        audioDuration: audioDuration ?? null,
        criseRelacionada: isCrisisPopup,
        criadoEm: optimisticUserMsg.criadoEm,
      });

      const offlineReply: ChatMessage = {
        id: `local-friend-${Date.now() + 1}`,
        remetente: 'FRIEND',
        tipo: 'TEXT',
        conteudoTexto: buildOfflineFriendReply({
          firstName,
          friendName,
          userText: optimisticUserMsg.conteudoTexto,
          tipo,
        }),
        criseRelacionada: isCrisisPopup,
        criadoEm: new Date().toISOString(),
      };

      const updatedOffline = [...withOptimistic, offlineReply];
      setMessages(updatedOffline);
      await saveCachedMessages(userId, updatedOffline);
      setIsSending(false);
      scrollToBottom();
      return;
    }

    try {
      const response = await api.sendChatMessage({
        tipo,
        conteudoTexto: optimisticUserMsg.conteudoTexto,
        audioUrl: audioUrl ?? null,
        audioDuration: audioDuration ?? null,
        criseRelacionada: isCrisisPopup,
      });

      const updatedOnline = [
        ...messages,
        response.userMessage,
        response.friendMessage,
      ];
      setMessages(updatedOnline);
      setTokenWarning(response.tokenWarning ?? null);
      await saveCachedMessages(userId, updatedOnline);
      scrollToBottom();
    } catch {
      // Se a rede caiu no meio do envio, salva no outbox offline e responde localmente
      await enqueueOfflineMessage({
        localId: optimisticUserMsg.id,
        userId,
        tipo,
        conteudoTexto: optimisticUserMsg.conteudoTexto,
        audioUrl: audioUrl ?? null,
        audioDuration: audioDuration ?? null,
        criseRelacionada: isCrisisPopup,
        criadoEm: optimisticUserMsg.criadoEm,
      });

      const fallbackReply: ChatMessage = {
        id: `local-friend-${Date.now() + 1}`,
        remetente: 'FRIEND',
        tipo: 'TEXT',
        conteudoTexto: buildOfflineFriendReply({
          firstName,
          friendName,
          userText: optimisticUserMsg.conteudoTexto,
          tipo,
        }),
        criseRelacionada: isCrisisPopup,
        criadoEm: new Date().toISOString(),
      };

      const updatedFallback = [
        ...messages,
        { ...optimisticUserMsg, pendingSync: true },
        fallbackReply,
      ];
      setMessages(updatedFallback);
      await saveCachedMessages(userId, updatedFallback);
      scrollToBottom();
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;
    setInputText('');
    await dispatchMessage({
      tipo: 'TEXT',
      conteudoTexto: trimmed,
    });
  };

  const handleQuickPrompt = async (promptText: string) => {
    if (isSending) return;
    await dispatchMessage({
      tipo: 'TEXT',
      conteudoTexto: promptText,
    });
  };

  const handleSendAudio = async (payload: {
    audioDataUrl: string;
    durationSeconds: number;
    transcription: string;
  }) => {
    await dispatchMessage({
      tipo: 'AUDIO',
      conteudoTexto:
        payload.transcription || '[Mensagem de voz enviada — desabafo em áudio]',
      audioUrl: payload.audioDataUrl,
      audioDuration: payload.durationSeconds,
    });
  };

  const handleDownloadPdfReport = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setErrorBanner(null);

    try {
      if (navigator.onLine) {
        const { report } = await api.getChatReportData();
        generateAndDownloadChatReportPdf(report);
      } else {
        const offlineReport = buildOfflineReportFromMessages({
          userName: user?.nome ?? firstName,
          friendName,
          messages,
        });
        generateAndDownloadChatReportPdf(offlineReport);
      }
      setStatusToast('Relatório em PDF gerado com sucesso!');
      window.setTimeout(() => setStatusToast(null), 3500);
    } catch {
      const offlineReport = buildOfflineReportFromMessages({
        userName: user?.nome ?? firstName,
        friendName,
        messages,
      });
      generateAndDownloadChatReportPdf(offlineReport);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-calm-100 bg-white shadow-2xl">
      {/* Cabeçalho do Amigo */}
      <header className="border-b border-calm-100 bg-gradient-to-r from-calm-700 to-calm-600 px-4 py-3.5 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white shadow-inner">
              <HeartHandshake className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-base font-bold tracking-tight">
                  {friendName}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setDraftFriendName(friendName);
                    setIsEditingName((prev) => !prev);
                  }}
                  title="Escolher ou editar o nome do seu amigo(a)"
                  aria-label="Editar nome do amigo"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-0.5 text-[11px] font-medium text-calm-50 transition hover:bg-white/25"
                >
                  <Pencil className="h-3 w-3" />
                  Mudar nome
                </button>
              </div>

              <div className="mt-0.5 flex items-center gap-2 text-xs text-calm-100">
                {isOnline ? (
                  <span className="inline-flex items-center gap-1">
                    <Wifi className="h-3 w-3 text-emerald-300" />
                    Aqui com você • escuta acolhedora
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-200">
                    <CloudOff className="h-3 w-3" />
                    Modo Offline • salvando no celular
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggleButton variant="headerDark" showLabel={false} />

            <button
              type="button"
              onClick={() => void handleClearHistory()}
              disabled={isClearingHistory}
              title="Apagar conversa e começar um novo assunto do zero"
              aria-label="Apagar conversa"
              className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-rose-500/80 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden md:inline">Apagar conversa</span>
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadPdfReport()}
              disabled={isGeneratingPdf}
              title="Baixar Relatório de Conversas em PDF com indicação de gatilhos"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/25 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isGeneratingPdf ? 'Gerando PDF...' : 'Relatório PDF'}
              </span>
              <span className="sm:hidden">PDF</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Voltar"
                aria-label="Fechar janela de conversa"
                className="rounded-xl bg-white/15 p-2 text-white transition hover:bg-white/25"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Painel expansível para personalizar o nome do amigo */}
        {isEditingName && (
          <form
            onSubmit={(e) => void handleSaveFriendName(e)}
            className="mt-3 rounded-2xl bg-calm-800/80 p-3 text-xs backdrop-blur"
          >
            <p className="mb-2 font-medium text-calm-100">
              Como você quer chamar seu amigo(a) de conversa?
            </p>
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {SUGGESTED_FRIEND_NAMES.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setDraftFriendName(suggestion)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    draftFriendName === suggestion
                      ? 'bg-white text-calm-800'
                      : 'bg-white/15 text-calm-50 hover:bg-white/25'
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={60}
                value={draftFriendName}
                onChange={(e) => setDraftFriendName(e.target.value)}
                placeholder="Digite o nome do seu amigo(a)..."
                className="flex-1 rounded-xl border border-white/20 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 outline-none"
              />
              <button
                type="submit"
                disabled={isSavingName}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                <Check className="h-3.5 w-3.5" />
                Salvar
              </button>
            </div>
          </form>
        )}
      </header>

      {/* Notificações rápidas e Aviso Discreto de Tokens Diários */}
      {tokenWarning && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{tokenWarning}</span>
        </div>
      )}

      {statusToast && (
        <div className="bg-emerald-50 px-4 py-2 text-center text-xs font-semibold text-emerald-800">
          {statusToast}
        </div>
      )}

      {errorBanner && (
        <div className="bg-rose-50 px-4 py-2 text-center text-xs font-medium text-rose-700">
          {errorBanner}
        </div>
      )}

      {/* Lista de Mensagens */}
      <div className="flex-1 space-y-3.5 overflow-y-auto bg-gradient-to-b from-calm-50/60 via-white to-calm-50/40 px-4 py-4">
        {isLoadingHistory ? (
          <div className="flex h-40 items-center justify-center text-xs text-slate-500">
            Preparando espaço de conversa com {friendName}...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center text-xs text-slate-500">
            <HeartHandshake className="h-8 w-8 text-calm-500" />
            <p className="font-semibold text-slate-700">
              Nova conversa com {friendName}
            </p>
            <p>
              Escreva abaixo ou grave um áudio no microfone para começar um novo assunto do zero.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.remetente === 'USER';
            const timeLabel = new Date(msg.criadoEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[75%] ${
                    isUser
                      ? 'rounded-br-sm bg-calm-600 text-white'
                      : 'rounded-bl-sm border border-calm-100 bg-white text-slate-800'
                  }`}
                >
                  <p
                    className={`mb-1 text-[11px] font-bold ${
                      isUser ? 'text-calm-100' : 'text-calm-700'
                    }`}
                  >
                    {isUser ? 'Você' : friendName}
                  </p>

                  {msg.tipo === 'AUDIO' ? (
                    <AudioMessageBubble
                      audioUrl={msg.audioUrl}
                      audioDuration={msg.audioDuration}
                      transcriptionText={msg.conteudoTexto}
                      isUser={isUser}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.conteudoTexto}
                    </p>
                  )}

                  <div
                    className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${
                      isUser ? 'text-calm-100' : 'text-slate-400'
                    }`}
                  >
                    <span>{timeLabel}</span>
                    {msg.pendingSync && (
                      <span
                        title="Salvo offline — será sincronizado quando a conexão voltar"
                        className="inline-flex items-center gap-0.5 text-amber-200"
                      >
                        <Clock className="h-3 w-3" />
                        offline
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isSending && (
          <div className="flex items-start">
            <div className="rounded-2xl rounded-bl-sm border border-calm-100 bg-white px-4 py-2.5 text-xs font-medium text-calm-700 shadow-sm">
              {friendName} está te ouvindo e escrevendo...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugestões rápidas de desabafo / acolhimento */}
      <div className="border-t border-calm-100 bg-calm-50/60 px-3 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-calm-700">
            <Sparkles className="h-3 w-3" />
            Desabafo rápido:
          </span>
          {QUICK_STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isSending}
              onClick={() => void handleQuickPrompt(prompt)}
              className="shrink-0 rounded-full border border-calm-200 bg-white px-3 py-1 text-xs font-medium text-calm-800 transition hover:bg-calm-100 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Barra de digitação + Gravação de Áudio estilo WhatsApp */}
      <footer className="border-t border-calm-100 bg-white p-3">
        <form onSubmit={(e) => void handleSendText(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Converse com ${friendName} ou grave um áudio no microfone...`}
            maxLength={2000}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-calm-500 focus:bg-white focus:ring-2 focus:ring-calm-200"
          />

          {inputText.trim().length > 0 ? (
            <button
              type="submit"
              disabled={isSending}
              aria-label="Enviar mensagem de texto"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-calm-600 text-white shadow-md shadow-calm-600/20 transition hover:bg-calm-700 active:scale-95 disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <AudioRecorderBar
              disabled={isSending}
              onSendAudio={handleSendAudio}
              onError={(msg) => setErrorBanner(msg)}
            />
          )}
        </form>
      </footer>
    </div>
  );
}
