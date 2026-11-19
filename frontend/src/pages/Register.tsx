import { Calendar, HeartHandshake, Lock, Mail, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HumanVerification } from '../components/auth/HumanVerification';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = Boolean(
    nome.trim().length >= 2 &&
      email.trim() &&
      senha.length >= 6 &&
      dataNascimento &&
      captchaToken &&
      !isSubmitting
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!captchaToken) {
      setError('Conclua a verificação "Não sou um robô" antes de continuar.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await register({
        nome,
        email,
        senha,
        dataNascimento,
        captchaToken,
      });
      // Novo usuário sempre vai para a tela de perfil musical para preparar o cache offline
      navigate('/preferences', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível concluir seu cadastro. Tente novamente.'
      );
      setCaptchaResetSignal((prev) => prev + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-calm-50 via-white to-calm-100/60 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-calm-100 bg-white/95 p-7 shadow-xl shadow-calm-900/5 backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-calm-100 text-calm-700">
            <HeartHandshake className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Crie seu espaço de apoio
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sua sessão ficará salva no celular para acesso imediato quando precisar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nome completo
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="reg-name"
                type="text"
                required
                minLength={2}
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como podemos te chamar?"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-calm-500 focus:bg-white focus:ring-2 focus:ring-calm-200"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="reg-email"
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
            <label htmlFor="reg-dob" className="mb-1.5 block text-sm font-medium text-slate-700">
              Data de nascimento
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="reg-dob"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-calm-500 focus:bg-white focus:ring-2 focus:ring-calm-200"
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Senha
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="reg-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
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
            {isSubmitting ? 'Criando conta...' : 'Criar conta e continuar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Já possui uma conta?{' '}
          <Link to="/login" className="font-semibold text-calm-700 hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
