import { CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { CaptchaChallenge } from '../../types';

interface HumanVerificationProps {
  /** Dispara sempre que o token assinado válido fica pronto ou volta a ficar inválido */
  onTokenChange: (captchaToken: string | null) => void;
  /** Incrementar este número força o recarregamento de um novo desafio após erro de envio */
  resetSignal?: number;
}

export function HumanVerification({
  onTokenChange,
  resetSignal = 0,
}: HumanVerificationProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecked, setIsChecked] = useState(false);
  const [answer, setAnswer] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadChallenge = useCallback(async () => {
    setIsLoading(true);
    setIsChecked(false);
    setAnswer('');
    setIsVerified(false);
    setErrorMessage(null);
    onTokenChange(null);

    try {
      const nextChallenge = await api.getCaptcha();
      setChallenge(nextChallenge);
    } catch {
      setErrorMessage('Não foi possível carregar a verificação. Verifique sua conexão.');
    } finally {
      setIsLoading(false);
    }
  }, [onTokenChange]);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge, resetSignal]);

  const handleAnswerChange = (rawValue: string) => {
    const digitsOnly = rawValue.replace(/[^\d]/g, '').slice(0, 3);
    setAnswer(digitsOnly);
    setErrorMessage(null);

    if (!challenge || !digitsOnly) {
      setIsVerified(false);
      onTokenChange(null);
      return;
    }

    // Validação rápida da resposta na UX; a validação criptográfica definitiva ocorre no backend
    const match = challenge.question.match(/(\d+)\s*\+\s*(\d+)/);
    const expected = match ? Number(match[1]) + Number(match[2]) : null;
    const numericAnswer = Number(digitsOnly);

    if (expected !== null && numericAnswer === expected) {
      setIsVerified(true);
      onTokenChange(`${challenge.challengeToken}:${numericAnswer}`);
    } else {
      setIsVerified(false);
      onTokenChange(null);
    }
  };

  return (
    <div className="rounded-2xl border border-calm-200 bg-calm-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-3 select-none">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={isLoading || !challenge}
            onChange={(e) => {
              setIsChecked(e.target.checked);
              if (!e.target.checked) {
                setAnswer('');
                setIsVerified(false);
                onTokenChange(null);
              }
            }}
            className="h-5 w-5 rounded border-calm-400 text-calm-600 focus:ring-calm-500"
          />
          <span className="text-sm font-medium text-slate-700">
            Não sou um robô
          </span>
        </label>

        <div className="flex items-center gap-2 text-xs text-calm-700">
          {isVerified ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Verificado
            </span>
          ) : (
            <ShieldCheck className="h-4 w-4 text-calm-600" />
          )}
          <button
            type="button"
            onClick={() => void loadChallenge()}
            title="Gerar novo desafio"
            className="rounded-lg p-1 text-slate-500 transition hover:bg-calm-100 hover:text-calm-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isChecked && challenge && (
        <div className="mt-3 flex items-center gap-3 border-t border-calm-200/80 pt-3">
          <span className="text-sm font-medium text-slate-700">
            {challenge.question}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={answer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder="Resposta"
            aria-label="Resposta da verificação anti-robô"
            className="w-24 rounded-xl border border-calm-300 bg-white px-3 py-1.5 text-center text-sm font-semibold text-slate-800 outline-none focus:border-calm-600 focus:ring-2 focus:ring-calm-200"
          />
        </div>
      )}

      {errorMessage && (
        <p className="mt-2 text-xs text-rose-600">{errorMessage}</p>
      )}
    </div>
  );
}
