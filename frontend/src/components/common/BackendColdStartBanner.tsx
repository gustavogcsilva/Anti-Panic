import { Loader2, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribeColdStart } from '../../services/api';

export function BackendColdStartBanner() {
  const [isColdStarting, setIsColdStarting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeColdStart((active) => {
      setIsColdStarting(active);
      if (active) {
        setIsDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  if (!isColdStarting || isDismissed) {
    return null;
  }

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[75] w-[94%] max-w-lg -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3 rounded-3xl border border-calm-200 bg-white/95 p-4 shadow-xl shadow-calm-950/10 backdrop-blur dark:border-calm-800 dark:bg-slate-900/95">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-calm-100 text-calm-700 dark:bg-calm-950 dark:text-calm-300">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>

        <div className="flex-1 pr-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
            <span>Servidor despertando (hospedagem gratuita)</span>
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          </div>

          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            A primeira resposta após inatividade pode levar até 40s para acordar. Fique
            tranquilo: <strong>suas músicas salvas, respiração e o chat continuam funcionando normalmente offline!</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          title="Fechar aviso"
          aria-label="Dispensar aviso de inicialização do servidor"
          className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
