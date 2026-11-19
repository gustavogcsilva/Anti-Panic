import { HeartHandshake, Lock, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HumanVerification } from '../components/auth/HumanVerification';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = Boolean(email.trim() && senha && captchaToken && !isSubmitting);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!captchaToken) {
      setError('Por favor, conclua a verificação "Não sou um robô".');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const user = await login({ email, senha, captchaToken });
      navigate(user.hasPreferences ? '/' : '/preferences', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível entrar agora. Tente novamente.'
      );
      setCaptchaResetSignal((prev) => prev + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-calm-50 via-white to-calm-100/60 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-calm-100 bg-white/95 p-7 shadow-xl shadow-calm-900/5 backdrop-blur">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-calm-100 text-calm-700">
            <HeartHandshake className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Bem-vindo de volta
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Seu espaço seguro de calma, disponível até mesmo offline.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-calm-500 focus:bg-white focus:ring-2 focus:ring-calm-200"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
                Senha
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-calm-700 transition hover:text-calm-800 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-calm-500 focus:bg-white focus:ring-2 focus:ring-calm-200"
              />
            </div>
          </div>

          <HumanVerification
            onTokenChange={setCaptchaToken}
            resetSignal={captchaResetSignal}
          />

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
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-calm-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-calm-600/20 transition hover:bg-calm-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Ainda não tem conta?{' '}
          <Link to="/register" className="font-semibold text-calm-700 hover:underline">
            Criar conta gratuita
          </Link>
        </p>
      </div>
    </div>
  );
}
