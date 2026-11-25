import type {
  ChatMessage,
  ChatMessageType,
  ChatReportData,
  DailyConversationReport,
} from '../types';

const DB_NAME = 'respira_chat_offline_db_v1';
const DB_VERSION = 1;
const STORE_MESSAGES = 'chat_messages_cache';
const STORE_OUTBOX = 'chat_outbox_queue';

export interface OutboxChatEntry {
  localId: string;
  userId: string;
  tipo: ChatMessageType;
  conteudoTexto: string;
  audioUrl?: string | null;
  audioDuration?: number | null;
  criseRelacionada: boolean;
  criadoEm: string;
}

function openChatDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        db.createObjectStore(STORE_MESSAGES, { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const outbox = db.createObjectStore(STORE_OUTBOX, { keyPath: 'localId' });
        outbox.createIndex('by_user', 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCachedMessages(
  userId: string,
  messages: ChatMessage[]
): Promise<void> {
  try {
    const db = await openChatDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      tx.objectStore(STORE_MESSAGES).put({
        userId,
        messages: messages.slice(-150),
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback silencioso se IndexedDB estiver bloqueado
  }
}

export async function getCachedMessages(userId: string): Promise<ChatMessage[]> {
  try {
    const db = await openChatDb();
    const record = await new Promise<{ messages?: ChatMessage[] } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_MESSAGES, 'readonly');
        const req = tx.objectStore(STORE_MESSAGES).get(userId);
        req.onsuccess = () => resolve(req.result as { messages?: ChatMessage[] } | undefined);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    return record?.messages ?? [];
  } catch {
    return [];
  }
}

export async function enqueueOfflineMessage(entry: OutboxChatEntry): Promise<void> {
  try {
    const db = await openChatDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      tx.objectStore(STORE_OUTBOX).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignora falha de quota
  }
}

export async function getOfflineOutbox(userId: string): Promise<OutboxChatEntry[]> {
  try {
    const db = await openChatDb();
    const entries = await new Promise<OutboxChatEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readonly');
      const index = tx.objectStore(STORE_OUTBOX).index('by_user');
      const req = index.getAll(userId);
      req.onsuccess = () => resolve((req.result as OutboxChatEntry[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return entries.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  } catch {
    return [];
  }
}

export async function clearOfflineOutbox(userId: string): Promise<void> {
  try {
    const entries = await getOfflineOutbox(userId);
    if (entries.length === 0) return;
    const db = await openChatDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      for (const item of entries) {
        store.delete(item.localId);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignora
  }
}

/**
 * Gera uma resposta imediata de acolhimento quando o usuário está 100% offline,
 * garantindo que ele nunca fique sem resposta durante uma crise sem internet.
 */
export function buildOfflineFriendReply(params: {
  firstName: string;
  friendName: string;
  userText: string;
  tipo: ChatMessageType;
}): string {
  const { firstName, friendName, userText, tipo } = params;
  const lower = userText.toLowerCase();

  if (
    lower.includes('gritar') ||
    lower.includes('extravasar') ||
    lower.includes('raiva') ||
    lower.includes('explodir')
  ) {
    return `${firstName}, pode soltar tudo isso sem culpa! Mesmo sem internet agora, eu (${friendName}) estou aqui guardando seu desabafo com segurança. Se quiser gritar num travesseiro, gravar outro áudio soltando a voz ou expirar forte pela boca, faz isso agora. Como seu peito está se sentindo?`;
  }

  if (tipo === 'AUDIO') {
    return `Recebi seu áudio aqui no celular, ${firstName}! Falar em voz alta ajuda muito a tirar o peso do peito. Assim que a conexão voltar, sincronizo tudo automaticamente. Enquanto isso, solta os ombros e puxa o ar devagar comigo... O que mais você quer colocar pra fora?`;
  }

  return `Estou aqui com você mesmo offline, ${firstName}. Guardamos sua mensagem com segurança no dispositivo para sincronizar assim que a internet voltar. Respira fundo comigo (inspira em 4s, segura 2s, solta em 6s)... O que está te afligindo mais nesse momento?`;
}

/**
 * Constrói os dados do relatório PDF diretamente do cache local (IndexedDB) caso o usuário
 * queira gerar o PDF estando sem internet.
 */
export function buildOfflineReportFromMessages(params: {
  userName: string;
  friendName: string;
  messages: ChatMessage[];
  startDate?: string;
  endDate?: string;
}): ChatReportData {
  const { userName, friendName, startDate, endDate } = params;

  const filteredMessages = params.messages.filter((msg) => {
    const isoDate = msg.criadoEm.slice(0, 10);
    if (startDate && isoDate < startDate) return false;
    if (endDate && isoDate > endDate) return false;
    return true;
  });

  const formatIsoBr = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  let periodLabel = 'Todos os dias registrados';
  if (startDate && endDate) {
    periodLabel =
      startDate === endDate
        ? `Dia ${formatIsoBr(startDate)}`
        : `De ${formatIsoBr(startDate)} até ${formatIsoBr(endDate)}`;
  } else if (startDate) {
    periodLabel = `A partir de ${formatIsoBr(startDate)}`;
  } else if (endDate) {
    periodLabel = `Até ${formatIsoBr(endDate)}`;
  }

  const grouped = new Map<string, ChatMessage[]>();
  for (const msg of filteredMessages) {
    const isoDate = msg.criadoEm.slice(0, 10);
    const list = grouped.get(isoDate) ?? [];
    list.push(msg);
    grouped.set(isoDate, list);
  }

  const days: DailyConversationReport[] = [];

  for (const [isoDate, dayMessages] of grouped.entries()) {
    const [year, month, day] = isoDate.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    const userMsgs = dayMessages.filter((m) => m.remetente === 'USER');
    const combined = userMsgs.map((m) => m.conteudoTexto.toLowerCase()).join(' ');

    const triggers: string[] = [];
    if (/trabalho|chefe|faculdade|estudo|cobrança|pressão|prazo/.test(combined)) {
      triggers.push('Sobrecarga no trabalho/estudos e cobrança excessiva');
    }
    if (/sono|dormir|insônia|cansad|exaust/.test(combined)) {
      triggers.push('Noites mal dormidas, insônia e exaustão física/mental');
    }
    if (/gritar|extravasar|raiva|explodir|sufocad/.test(combined)) {
      triggers.push('Tensão acumulada e necessidade de extravasar/gritar');
    }
    if (/ansiedade|pânico|coração|falta de ar|peito|medo/.test(combined)) {
      triggers.push('Sintomas físicos e cognitivos agudos de ansiedade/pânico');
    }

    const dailySynthesis =
      triggers.length > 0
        ? `No dia ${formattedDate}, você conversou sobre: ${triggers.join('; ').toLowerCase()}. Ao final do relato, o padrão indica que a crise/ansiedade esteve associada a esses fatores mencionados.`
        : `No dia ${formattedDate}, você realizou ${userMsgs.length} interação(ões) de desabafo e autorregulação com ${friendName}.`;

    days.push({
      date: formattedDate,
      isoDate,
      crisisCount: userMsgs.filter((m) => m.criseRelacionada).length,
      detectedTriggers: triggers,
      dailySynthesis,
      messages: dayMessages.map((m) => ({
        id: m.id,
        remetente: m.remetente,
        tipo: m.tipo,
        conteudoTexto: m.conteudoTexto,
        audioDuration: m.audioDuration ?? null,
        criseRelacionada: m.criseRelacionada,
        criadoEm: m.criadoEm,
        horario: new Date(m.criadoEm).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    periodLabel,
    userName,
    friendName,
    totalMessages: filteredMessages.length,
    totalAudioMessages: filteredMessages.filter((m) => m.tipo === 'AUDIO').length,
    totalCrisisMessages: filteredMessages.filter(
      (m) => m.remetente === 'USER' && m.criseRelacionada
    ).length,
    totalPanicActivations: days.reduce((acc, d) => acc + d.crisisCount, 0),
    topTriggers: [],
    overallConclusion:
      'Relatório gerado em modo offline a partir das conversas salvas no dispositivo.',
    disclaimer:
      'Nota Importante: Esta síntese de gatilhos é gerada a partir dos temas mencionados nas suas conversas para fins de autoconhecimento e apoio terapêutico, não substituindo avaliação médica ou psicológica.',
    days,
  };
}
