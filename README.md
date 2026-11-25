# 🌿 Respira — PWA de Apoio Emocional Imediato

> **Um refúgio sensorial e empático para acolhimento de crises de ansiedade, pânico e descompressão emocional — disponível a qualquer momento, inclusive 100% offline.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646cff?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey?logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.3-2d3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Serverless-4169e1?logo=postgresql)](https://neon.tech/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-8e75ff?logo=google)](https://aistudio.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline_First-orange?logo=pwa)](https://developer.mozilla.org/docs/Web/Progressive_web_apps)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Sumário
- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades Principais](#-funcionalidades-principais)
- [Arquitetura e Tecnologias](#-arquitetura-e-tecnologias)
- [Estrutura de Pastas](#-estrutura-de-pastas)
- [Como Executar Localmente](#-como-executar-localmente)
- [Testes Automatizados e Segurança](#-testes-automatizados-e-segurança)
- [Deploy 100% Gratuito](#-deploy-100-gratuito)
- [Aviso Importante sobre Saúde Mental](#-aviso-importante-sobre-saúde-mental)

---

## 💡 Sobre o Projeto

O **Respira** é uma aplicação web progressiva (PWA) desenvolvida com foco em **UX/UI calmante**, **alta segurança** e **arquitetura Offline-First**. Ele foi projetado para acolher pessoas em momentos de ansiedade aguda, estresse excessivo ou crises de pânico.

Mesmo se o usuário estiver em um local sem cobertura de internet, em modo avião ou com sinal instável, o aplicativo abre instantaneamente, dispara vibrações táteis regulatórias, reproduz melodias acolhedoras em cache local, guia o ciclo de respiração e permite desabafar por texto ou áudio com um companheiro de conversa humanizado.

---

## ✨ Funcionalidades Principais

### 🚨 1. Botão de Pânico Sensorial ("PRECISO DE CALMA")
- **Vibração Tátil Calmante:** Dispara sequências hápticas rítmicas (`navigator.vibrate`) para ancoragem física.
- **Respiração Guiada 4-2-6:** Guia visual com transição suave (inspire 4s, segure 2s, solte 6s) para estabilização cardiorrespiratória.
- **Refúgio Sonoro Offline-First:** Sorteio de músicas por cantor via Deezer/iTunes API + paisagens sonoras sintetizadas via Web Audio API e áudios locais precacheados no PWA.
- **Acesso Imediato a Suporte:** Botão com ligação direta para o **CVV (188)** e para o contato de emergência configurado pelo usuário.
- **Pop-up de Conversa Imediata:** Botão destacado na tela de crise que abre um diálogo de acolhimento sem interromper a música ou a respiração.

### 💬 2. Companheiro de Conversa ("Amigo")
- **Identidade e Nome Personalizáveis:** O usuário escolhe o nome do amigo com quem quer conversar (*Léo, Bia, Rafa, Nina...*), podendo editar a qualquer momento no cabeçalho do chat ou nas preferências.
- **Tom Amigo para Amigo:** Respostas calorosas, empáticas e sem jargões clínicos, convidando gentilmente ao desabafo (*"O que você está sentindo agora? Vamos conversar"*, *"O que está te afligindo mais?"*).
- **Espaço Seguro para Extravasar:** Se o usuário expressar raiva, frustração intensa ou vontade de gritar, o amigo acolhe sem sermões, valida o sentimento e sugere formas seguras de descarga física e vocal.
- **Sugestões Práticas para Desacelerar:** Apresenta ideias variadas de acordo com o momento:
  - 🎬 **Filmes:** Histórias leves e reconfortantes (*Soul, Divertida Mente, Meu Amigo Totoro*).
  - 📖 **Livros:** Leituras curtas e acolhedoras (*O Menino, a Toupeira, a Raposa e o Cavalo*, *As Coisas que Você Só Vê Quando Desacelera*).
  - 🎵 **Músicas:** Seleções alinhadas às preferências salvas do usuário ou sons instrumentais relaxantes.
  - 🧘 **Exercícios:** Respiração 4-2-6, ancoragem sensorial 5-4-3-2-1 e alongamentos suaves.
  - 🚶 **Caminhadas:** Convites para tomar ar fresco e caminhar sem pressa observando o entorno.
- **Google Gemini API com Fallback Local:** No backend, conecta-se à API do **Google Gemini (`gemini-2.5-flash`)** de forma privada. Se a chave não for informada ou houver limite de cota gratuita (HTTP 429), o sistema aciona de forma limpa e transparente o motor empático local integrado.

### 🎙️ 3. Áudio Gravado Estilo WhatsApp
- Gravação nativa por microfone via `MediaRecorder` API compatível com Android, iOS e computadores desktop.
- Cronômetro em tempo real, visualizador de gravação, opção de cancelar/descartar na lixeira ou enviar.
- Player de áudio com controle de velocidade (`1x` / `1.5x`), barra de progresso interativa e transcrição opcional via Web Speech API (`pt-BR`).

### 🌓 4. Modo Dia e Modo Noturno
- Alternância instantânea de tema claro e escuro de baixo cansaço visual com cores acolhedoras.
- Persistido no `localStorage` e sincronizado com o banco de dados via endpoint dedicado (`PATCH /preferences/theme`).

### 📄 5. Relatório de Conversas em PDF com Indicação de Gatilhos
- Exportação em PDF com layout profissional gerado no cliente via `jsPDF`.
- Agrupa o histórico por data e exibe a **Indicação Diária de Gatilhos** identificados na conversa (sobrecarga de trabalho/estudos, insônia, tensão acumulada, conflitos, solidão ou ansiedade física).
- Inclui síntese longitudinal, plano prático de regulação e aviso ético esclarecendo que serve para autoconhecimento e apoio terapêutico, sem substituir diagnóstico médico.

### 📶 6. Offline-First & Resiliência a Cold Start
- Persistência offline completa com **IndexedDB** (`respira_chat_offline_db_v1`) para mensagens e fila de envio pendente (`outbox`).
- Sincronização automática em segundo plano quando a conexão com a internet retorna.
- **Banner de Cold Start:** Detecta requisições lentas em instâncias de backend gratuitas (ex: Render Free) e avisa suavemente ao usuário que o servidor está acordando, enquanto todas as funções offline continuam operantes.

---

## 🛠️ Arquitetura e Tecnologias

```
                    ┌───────────────────────────────────┐
                    │       Frontend (PWA / SPA)        │
                    │   React 19 + Vite + TailwindCSS   │
                    └─────────────────┬─────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │ HTTP / JSON             │ IndexedDB / ServiceWorker
            ▼                         ▼                         ▼
┌───────────────────────┐   ┌───────────────────┐     ┌───────────────────┐
│     Backend Node      │   │  IndexedDB Cache  │     │ CacheStorage PWA  │
│ Express + TypeScript  │   │ Mensagens & Áudio │     │  MP3s & Assets    │
└───────────┬───────────┘   └───────────────────┘     └───────────────────┘
            │
            ├────────────────────────────────────────┐
            ▼                                        ▼
┌─────────────────────────┐            ┌───────────────────────────┐
│ PostgreSQL (Neon Cloud) │            │ Google Gemini API v1beta  │
│  Prisma ORM via WS 443  │            │ (Amigo Virtual + Fallback)│
└─────────────────────────┘            └───────────────────────────┘
```

### Stack Detalhada

| Camada | Tecnologias |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, React Router 7, Lucide Icons, jsPDF, vite-plugin-pwa (Workbox) |
| **Backend** | Node.js, Express, TypeScript, tsx, Prisma ORM 6, @neondatabase/serverless, ws |
| **Banco de Dados** | PostgreSQL (compatível com Neon Serverless, Supabase e instâncias locais) |
| **Inteligência Artificial** | Google Gemini API (`gemini-2.5-flash`) + Motor Empático Local em TypeScript |
| **Segurança** | Assinatura HMAC SHA-256 para captcha anti-robô, JWT (sessão 30d), bcrypt, Helmet, Rate Limiter em memória, Prevenção contra IDOR e sanitização de tags |

---

## 📁 Estrutura de Pastas

```text
Anti-Panic/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # Modelos: User, UserPreferences, ChatMessage, ChatSession, PanicLog
│   │   └── push-neon.ts            # Script de sincronização DDL via WebSocket (porta 443)
│   ├── src/
│   │   ├── config/                 # Variáveis de ambiente validadas com Zod e cliente Prisma Neon
│   │   ├── controllers/            # Controladores REST: Auth, Chat, Preferences, PanicLog, Bot
│   │   ├── middlewares/            # Autenticação JWT, Rate Limiting e tratamento global de erros
│   │   ├── routes/                 # Definição e proteção das rotas da API
│   │   ├── services/               # Regras de negócio: ChatService (Gemini), BotCurador, Auth, Email
│   │   ├── tests/                  # Suíte de 14 testes automatizados (funcionais e de segurança)
│   │   ├── utils/                  # Utilitários: Captcha HMAC, hashing bcrypt, tokens JWT
│   │   ├── app.ts                  # Configuração do Express, CORS dinâmico e middlewares
│   │   └── server.ts               # Inicialização do servidor HTTP e graceful shutdown
│   ├── .env.example                # Documentação detalhada de variáveis do backend
│   └── package.json
│
├── frontend/
│   ├── public/
│   │   ├── audio/                  # Áudio MP3 local precacheado para emergência offline
│   │   ├── icons/                  # Ícones PWA para celulares e navegadores
│   │   └── _redirects              # Roteamento SPA para Netlify
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/               # Verificação Anti-Robô acessível e rotas protegidas
│   │   │   ├── chat/               # Painel do Amigo, gravador de áudio estilo WhatsApp e balão de áudio
│   │   │   ├── common/             # Banner suave de Cold Start do servidor gratuito
│   │   │   ├── panic/              # Botão de Pânico central, respiração guiada e overlay de crise
│   │   │   └── theme/              # Botão de alternância Modo Dia / Modo Noite
│   │   ├── contexts/               # AuthContext (sessão persistente) e ThemeContext (modo escuro)
│   │   ├── hooks/                  # usePanicMode (áudio, vibração e registro de crise)
│   │   ├── pages/                  # Home, Chat, Login, Register, Preferences, Forgot/Reset Password
│   │   ├── services/               # Cliente API fetch, cache IndexedDB offline e gerador de PDF
│   │   ├── types/                  # Definições completas de tipagem TypeScript
│   │   └── App.tsx                 # Roteamento principal e provedores
│   ├── .env.example                # Variável VITE_API_URL
│   ├── netlify.toml                # Configuração de build e redirects para Netlify
│   ├── vercel.json                 # Configuração de rewrites para Vercel
│   ├── vite.config.ts              # Configuração Vite + VitePWA e Service Worker
│   └── tailwind.config.js          # Configuração Tailwind com suporte a darkMode: 'class'
│
├── .gitignore                      # Blindagem de arquivos .env, chaves e credenciais
└── README.md                       # Documentação completa do projeto
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js** (v20 ou superior recomendado)
- **npm** (v9 ou superior)
- Uma string de conexão PostgreSQL (recomendado: [Neon](https://neon.tech/) gratuito, Supabase ou PostgreSQL local)

### 1. Clonar o Repositório
```bash
git clone https://github.com/gustavogcsilva/Anti-Panic.git
cd Anti-Panic
```

### 2. Configurar o Backend
```bash
cd backend
npm install
```

Crie o arquivo `backend/.env` baseado no `backend/.env.example`:
```env
PORT=3333
NODE_ENV=development
DATABASE_URL="postgresql://usuario:senha@host/banco?sslmode=require"
JWT_SECRET="chave-secreta-forte-com-mais-de-32-caracteres"
CAPTCHA_SECRET="outro-segredo-hmac-para-o-captcha-32-chars"
FRONTEND_URL="http://localhost:5173"
GEMINI_API_KEY="" # Opcional: pegue grátis em https://aistudio.google.com/app/apikey
GEMINI_MODEL="gemini-2.5-flash"
DAILY_CHAT_TOKEN_LIMIT=12000
```

Sincronize as tabelas no banco de dados e inicie o backend:
```bash
# Sincroniza o schema no PostgreSQL (Neon via porta 443 WebSockets)
npm run prisma:push

# Inicia o servidor de desenvolvimento na porta 3333
npm run dev
```

### 3. Configurar o Frontend
Em outro terminal:
```bash
cd frontend
npm install
```

Crie o arquivo `frontend/.env` baseado no `frontend/.env.example`:
```env
VITE_API_URL=http://localhost:3333
```

Inicie o servidor de desenvolvimento do Vite:
```bash
npm run dev
```

Abra no seu navegador em **`http://localhost:5173`**.

---

## 🧪 Testes Automatizados e Segurança

O projeto possui uma suíte completa de testes automatizados integrados em **[backend/src/tests/functionalAndSecurity.test.ts](backend/src/tests/functionalAndSecurity.test.ts)**.

Para rodar todos os testes:
```bash
cd backend
npm test
```

### O que a suíte valida (14 de 14 aprovados):

#### ✅ Testes Funcionais:
1. **Cadastro e Sessão Persistente:** Validação com desafio anti-robô criptográfico e emissão de JWT.
2. **Personalização e Modo Dia/Noite:** Configuração do nome do amigo (*"Léo"* $\rightarrow$ *"Bia"*) e alternância do tema noturno.
3. **Pop-up de Crise Pós-Botão de Pânico:** Abertura imediata com pergunta acolhedora inicial.
4. **Conversa e Acolhimento:** Desabafo sobre sobrecarga/insônia e acolhimento da vontade de gritar/extravasar sem julgamento.
5. **Sugestões Práticas:** Verificação obrigatória dos 5 pilares (*filmes, livros, músicas, exercícios e caminhadas*).
6. **Mensagem de Áudio Estilo WhatsApp:** Envio, persistência e metadados de duração de áudio.
7. **Sincronização Offline:** Enfileiramento de mensagens e sincronização via endpoint `/chat/sync`.
8. **Relatório de Conversas em PDF:** Agrupamento por data e síntese dos fatores/gatilhos desencadeantes.

#### 🔒 Testes de Segurança:
1. **Autenticação Obrigatória:** Bloqueio `401 Unauthorized` em todas as rotas privadas sem token.
2. **Prevenção contra IDOR:** Isolamento estrito de dados por ID de usuário (um usuário nunca acessa conversas ou relatórios de outro).
3. **Sanitização contra XSS:** Rejeição e neutralização de tags HTML/scripts no perfil e mensagens.
4. **Proteção de Mídia e Áudio:** Validação estrita de prefixos MIME de áudio permitidos e limite máximo de tamanho de payload.
5. **Varredura de Segredos no Frontend:** Verificação automatizada garantindo que chaves privadas (`GEMINI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, etc.) nunca sejam expostas no código do cliente.
6. **Blindagem no Git:** Auditoria confirmando que arquivos `.env`, certificados e chaves estão bloqueados no `.gitignore`.

---

## ☁️ Deploy 100% Gratuito

O projeto foi especificamente arquitetado para rodar com **custo zero** utilizando os melhores serviços com plano gratuito:

| Recurso | Provedor Recomendado | Configuração |
|---|---|---|
| **Frontend PWA** | [Vercel](https://vercel.com/) ou [Netlify](https://netlify.com/) | Root Directory: `frontend` • Build: `npm run build` • Output: `dist` • Variável: `VITE_API_URL` |
| **Backend API** | [Render](https://render.com/) (Web Service Free) | Root Directory: `backend` • Build: `npm install && npm run build` • Start: `npm run start` |
| **Banco de Dados** | [Neon](https://neon.tech/) (PostgreSQL Serverless) | Conexão segura na porta 443 via WebSocket (gratuita e sem cartão) |
| **Inteligência Artificial** | [Google AI Studio](https://aistudio.google.com/) | Gemini API free tier (`gemini-2.5-flash`) com fallback empático local |
| **Músicas** | Deezer Public API + Fallback iTunes + Web Audio API | Sorteio gratuito por cantor (sem API Key) + paisagens sonoras offline |

---

## 💛 Aviso Importante sobre Saúde Mental

> **O aplicativo Respira é uma ferramenta complementar de acolhimento sensorial, autoconhecimento e regulação emocional. Ele NÃO substitui acompanhamento psicológico, tratamento psiquiátrico ou intervenções de emergência médica.**

Se você ou alguém que você conhece está passando por um momento de sofrimento intenso ou crise suicida:
- Ligue gratuitamente para o **Centro de Valorização da Vida (CVV)** pelo número **188** (atendimento 24 horas por dia, em todo o Brasil).
- Procure o **SAMU (192)** ou a Unidade de Pronto Atendimento (UPA) mais próxima.
- Converse com pessoas de sua confiança. Você não precisa carregar tudo sozinho(a).

---

## 📄 Licença

Este projeto está licenciado sob a [Licença MIT](LICENSE). Sinta-se livre para usar, contribuir e compartilhar carinho.
