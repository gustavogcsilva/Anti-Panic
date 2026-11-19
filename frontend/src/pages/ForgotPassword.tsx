import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../services/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await api.forgotPassword(email);
      setSuccessMessage(response.message);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível enviar o e-mail de recuperação agora.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-calm-50 via-white to-calm-100/60 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-calm-100 bg-white/95 p-7 shadow-xl shadow-calm-900/5">
        <Link
          to="/login"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-calm-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </Link>

        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          Recuperar senha
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Informe o e-mail da sua conta. Enviaremos um link seguro para você criar uma nova senha.
        </p>

        {successMessage ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="leading-relaxed">{successMessage}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Seu e-mail cadastrado
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="forgot-email"
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
              disabled={!email.trim() || isSubmitting}
              className="w-full rounded-2xl bg-calm-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-calm-600/20 transition hover:bg-calm-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? 'Enviando link...' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
