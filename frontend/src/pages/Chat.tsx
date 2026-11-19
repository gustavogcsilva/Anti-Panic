import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FriendChatPanel } from '../components/chat/FriendChatPanel';

export function Chat() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-calm-50 via-white to-calm-100/60 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto mb-3 flex w-full max-w-3xl items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-xl border border-calm-200 bg-white px-3 py-2 text-xs font-semibold text-calm-800 shadow-sm transition hover:bg-calm-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o Botão de Pânico
        </Link>
        <span className="text-xs font-medium text-slate-500">
          Espaço seguro • Texto e Áudio Offline-First
        </span>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col h-[calc(100vh-5.5rem)]">
        <FriendChatPanel />
      </main>
    </div>
  );
}
