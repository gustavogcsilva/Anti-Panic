import {
  Check,
  Music2,
  Phone,
  Plus,
  Shuffle,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ApiError, api } from '../services/api';
import { prefetchOfflineTracks } from '../services/audioCache';

const SUGGESTED_GENRES = [
  { id: 'acoustic', label: 'Acústico' },
  { id: 'pop', label: 'Pop Alegre' },
  { id: 'indie', label: 'Indie Leve' },
  { id: 'ambient', label: 'Ambiente / Paz' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'jazz', label: 'Jazz Suave' },
  { id: 'classical', label: 'Clássica / Piano' },
  { id: 'folk', label: 'Folk' },
  { id: 'reggae', label: 'Reggae Positivo' },
  { id: 'electronic', label: 'Chillout' },
];

export function Preferences() {
  const { user, token, updateLocalPreferences } = useAuth();
  const navigate = useNavigate();

  const [generosMusicais, setGenerosMusicais] = useState<string[]>(
    user?.preferences?.generosMusicais ?? []
  );
  const [customGenre, setCustomGenre] = useState('');
  const [artistasPreferidos, setArtistasPreferidos] = useState<string[]>(
    user?.preferences?.artistasPreferidos ?? []
  );
  const [artistInput, setArtistInput] = useState('');
  const [modoAleatorio, setModoAleatorio] = useState<boolean>(
    user?.preferences?.modoAleatorio ?? false
  );
  const [contatoEmergenciaNome, setContatoEmergenciaNome] = useState(
    user?.preferences?.contatoEmergenciaNome ?? ''
  );
  const [contatoEmergenciaTelefone, setContatoEmergenciaTelefone] = useState(
    user?.preferences?.contatoEmergenciaTelefone ?? ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadExisting = async () => {
      try {
        const { preferences } = await api.getPreferences();
        if (!active) return;
        setGenerosMusicais(preferences.generosMusicais ?? []);
        setArtistasPreferidos(preferences.artistasPreferidos ?? []);
        setModoAleatorio(Boolean(preferences.modoAleatorio));
        setContatoEmergenciaNome(preferences.contatoEmergenciaNome ?? '');
        setContatoEmergenciaTelefone(preferences.contatoEmergenciaTelefone ?? '');
      } catch {
        // Usa snapshot em memória se estiver sem rede
      }
    };
    void loadExisting();
    return () => {
      active = false;
    };
  }, []);

  const toggleGenre = (genreId: string) => {
    setError(null);
    setModoAleatorio(false);
    setGenerosMusicais((prev) =>
      prev.includes(genreId)
        ? prev.filter((item) => item !== genreId)
        : prev.length < 10
          ? [...prev, genreId]
          : prev
    );
  };

  const addCustomGenre = () => {
    const cleaned = customGenre.trim().toLowerCase();
    if (!cleaned) return;
    setError(null);
    setModoAleatorio(false);
    if (!generosMusicais.includes(cleaned) && generosMusicais.length < 10) {
      setGenerosMusicais((prev) => [...prev, cleaned]);
    }
    setCustomGenre('');
  };

  const addArtist = () => {
    const cleaned = artistInput.trim();
    if (!cleaned) return;
    setError(null);
    setModoAleatorio(false);
    if (
      !artistasPreferidos.some((a) => a.toLowerCase() === cleaned.toLowerCase()) &&
      artistasPreferidos.length < 10
    ) {
      setArtistasPreferidos((prev) => [...prev, cleaned]);
    }
    setArtistInput('');
  };

  const removeArtist = (artist: string) => {
    setArtistasPreferidos((prev) => prev.filter((item) => item !== artist));
  };

  const handleKeyDownAdd = (event: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      action();
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!modoAleatorio && generosMusicais.length === 0 && artistasPreferidos.length === 0) {
      setError(
        'Escolha ao menos um gênero musical, informe um artista ou ative o Modo Aleatório.'
      );
      return;
    }

    setIsSaving(true);

    try {
      const { preferences } = await api.savePreferences({
        generosMusicais,
        artistasPreferidos,
        modoAleatorio,
        contatoEmergenciaNome: contatoEmergenciaNome.trim() || null,
        contatoEmergenciaTelefone: contatoEmergenciaTelefone.trim() || null,
      });

      updateLocalPreferences(preferences);

      // Dispara o pré-carregamento em background das 5 faixas no Cache Storage offline
      void prefetchOfflineTracks(token);

      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível salvar suas preferências agora.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-calm-50 via-white to-calm-100/50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-calm-100 text-calm-700">
            <Music2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Personalize seu refúgio sonoro
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Olá, <span className="font-semibold text-calm-800">{user?.nome?.split(' ')[0]}</span>!
            Conte o que traz paz ou alegria para você. Vamos guardar 5 músicas no seu celular para
            tocar na hora, mesmo sem internet.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card Destacado: Modo Aleatório */}
          <button
            type="button"
            onClick={() => {
              setModoAleatorio((prev) => !prev);
              setError(null);
            }}
            className={`w-full rounded-3xl border-2 p-5 text-left transition ${
              modoAleatorio
                ? 'border-calm-600 bg-calm-600 text-white shadow-lg shadow-calm-600/20'
                : 'border-calm-200 bg-white text-slate-800 hover:border-calm-400'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                    modoAleatorio ? 'bg-white/20 text-white' : 'bg-calm-100 text-calm-700'
                  }`}
                >
                  <Shuffle className="h-5 w-5" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 text-base font-bold">
                    Modo Aleatório
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <p
                    className={`mt-1 text-sm leading-relaxed ${
                      modoAleatorio ? 'text-calm-50' : 'text-slate-500'
                    }`}
                  >
                    Deixar o Bot escolher livremente músicas relaxantes, acolhedoras e alegres
                    para mim.
                  </p>
                </div>
              </div>

              <div
                className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  modoAleatorio
                    ? 'border-white bg-white text-calm-700'
                    : 'border-slate-300 bg-transparent'
                }`}
              >
                {modoAleatorio && <Check className="h-4 w-4 stroke-[3]" />}
              </div>
            </div>
          </button>

          {/* Seção 1: Gêneros Musicais */}
          <section
            className={`rounded-3xl border border-calm-100 bg-white p-5 shadow-sm transition ${
              modoAleatorio ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <h2 className="text-base font-semibold text-slate-800">
              1. Gêneros musicais que te fazem bem
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Toque para selecionar 2 ou 3 estilos, ou digite o seu abaixo.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED_GENRES.map((genre) => {
                const selected = generosMusicais.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.id)}
                    className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                      selected
                        ? 'bg-calm-600 text-white shadow-sm'
                        : 'bg-calm-50 text-calm-800 hover:bg-calm-100'
                    }`}
                  >
                    {genre.label}
                  </button>
                );
              })}

              {/* Exibe gêneros personalizados adicionados pelo usuário */}
              {generosMusicais
                .filter((g) => !SUGGESTED_GENRES.some((s) => s.id === g))
                .map((custom) => (
                  <span
                    key={custom}
                    className="inline-flex items-center gap-1 rounded-full bg-calm-600 px-3.5 py-2 text-xs font-semibold text-white"
                  >
                    {custom}
                    <button
                      type="button"
                      onClick={() => toggleGenre(custom)}
                      aria-label={`Remover ${custom}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={customGenre}
                onChange={(e) => setCustomGenre(e.target.value)}
                onKeyDown={(e) => handleKeyDownAdd(e, addCustomGenre)}
                placeholder="Outro gênero (ex: bossa nova, gospel, piano)..."
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-calm-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={addCustomGenre}
                className="inline-flex items-center gap-1 rounded-2xl bg-calm-100 px-4 py-2.5 text-sm font-semibold text-calm-800 transition hover:bg-calm-200"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>
          </section>

          {/* Seção 2: Cantores ou Artistas */}
          <section
            className={`rounded-3xl border border-calm-100 bg-white p-5 shadow-sm transition ${
              modoAleatorio ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <h2 className="text-base font-semibold text-slate-800">
              2. Cantores ou artistas que te acalmam
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Opcional — o Bot tentará buscar faixas relacionadas ou semelhantes.
            </p>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={artistInput}
                onChange={(e) => setArtistInput(e.target.value)}
                onKeyDown={(e) => handleKeyDownAdd(e, addArtist)}
                placeholder="Digite o nome de um artista e toque em +"
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-calm-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={addArtist}
                className="inline-flex items-center gap-1 rounded-2xl bg-calm-100 px-4 py-2.5 text-sm font-semibold text-calm-800 transition hover:bg-calm-200"
              >
                <Plus className="h-4 w-4" />
                Incluir
              </button>
            </div>

            {artistasPreferidos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {artistasPreferidos.map((artist) => (
                  <span
                    key={artist}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    {artist}
                    <button
                      type="button"
                      onClick={() => removeArtist(artist)}
                      aria-label={`Remover ${artist}`}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Seção 3: Contato de Emergência */}
          <section className="rounded-3xl border border-calm-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">
              3. Pessoa de confiança (opcional)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Ficará disponível para ligação com 1 toque no Modo Crise, junto ao CVV (188).
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={contatoEmergenciaNome}
                  onChange={(e) => setContatoEmergenciaNome(e.target.value)}
                  placeholder="Nome (ex: Mãe, Ana)"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-calm-500 focus:bg-white"
                />
              </div>

              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={contatoEmergenciaTelefone}
                  onChange={(e) => setContatoEmergenciaTelefone(e.target.value)}
                  placeholder="Telefone com DDD"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-calm-500 focus:bg-white"
                />
              </div>
            </div>
          </section>

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
            disabled={isSaving}
            className="w-full rounded-2xl bg-calm-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-calm-600/20 transition hover:bg-calm-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSaving
              ? 'Salvando e preparando suas músicas...'
              : 'Salvar e ir para o Botão de Pânico'}
          </button>
        </form>
      </div>
    </div>
  );
}
