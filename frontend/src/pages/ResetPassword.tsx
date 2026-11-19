import { CheckCircle2, Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../services/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Token de recuperação ausente. Solicite um novo link.');
      return;
    }

    if (novaSenha.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.resetPassword({ token, novaSenha });
      setSuccessMessage(response.message);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível atualizar sua senha. Tente solicitar um novo link.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-calm-50 via-white to-calm-100/60 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-calm-100 bg-white/95 p-7 shadow-xl shadow-calm-900/5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Criar nova senha
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Escolha uma nova senha segura para retomar o acesso à sua conta.
        </p>

        {successMessage ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p>{successMessage}</p>
              </div>
            </div>
            <Link
              to="/login"
              className="block w-full rounded-2xl bg-calm-600 px-4 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-calm-700"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Nova senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-calm-500 focus:bg-white focus:ring-2 focus:ring-calm-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirmar nova senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-calm-500 focus:bg-white focus:ring-2 focus:ring-calm-200"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!novaSenha || !confirmarSenha || isSubmitting}
              className="w-full rounded-2xl bg-calm-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-calm-600/20 transition hover:bg-calm-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
