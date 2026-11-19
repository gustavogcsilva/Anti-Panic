import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { app } from '../app';
import { prisma } from '../config/prisma';
import { createCaptchaChallenge } from '../utils/captcha';

function solveInternalCaptcha(): string {
  const challenge = createCaptchaChallenge();
  const match = challenge.question.match(/(\d+)\s*\+\s*(\d+)/);
  if (!match) {
    throw new Error('Falha ao extrair números do desafio captcha');
  }
  const sum = Number(match[1]) + Number(match[2]);
  return `${challenge.challengeToken}:${sum}`;
}

async function requestJson(
  baseUrl: string,
  route: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {}
): Promise<{ status: number; data: Record<string, any> }> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, any>;
  return { status: response.status, data };
}

async function runSuite() {
  console.log('🧪 Iniciando Testes Automatizados de Funcionamento e Segurança (Respira PWA)...\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Não foi possível iniciar servidor de testes');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const testEmails: string[] = [];

  try {
    // =========================================================================
    // 1. TESTES DE FUNCIONAMENTO
    // =========================================================================
    console.log('▶ [FUNCIONAL 1/8] Cadastro e sessão persistente com verificação anti-robô...');
    const userAEmail = `teste.funcional.${Date.now()}@respira.local`;
    testEmails.push(userAEmail);

    const regRes = await requestJson(baseUrl, '/auth/register', {
      method: 'POST',
      body: {
        nome: 'Mariana Silva',
        email: userAEmail,
        senha: 'SenhaForte123!',
        dataNascimento: '1998-05-14',
        captchaToken: solveInternalCaptcha(),
      },
    });

    assert.strictEqual(regRes.status, 201, `Esperava 201 no cadastro, recebeu ${regRes.status}`);
    assert.ok(regRes.data.token, 'Token JWT deve ser retornado no cadastro');
    const tokenA = regRes.data.token as string;

    const meRes = await requestJson(baseUrl, '/auth/me', { token: tokenA });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.user.email, userAEmail);
    console.log('  ✔ Cadastro e sessão persistente validados.');

    console.log('▶ [FUNCIONAL 2/8] Personalização do Nome do Amigo e Alternância Modo Dia/Noite...');
    const prefRes = await requestJson(baseUrl, '/preferences', {
      method: 'PUT',
      token: tokenA,
      body: {
        nomeAmigo: 'Léo',
        temaNoturno: false,
        generosMusicais: ['acoustic', 'lofi'],
        artistasPreferidos: [],
        modoAleatorio: false,
        contatoEmergenciaNome: 'Mãe',
        contatoEmergenciaTelefone: '11999999999',
      },
    });
    assert.strictEqual(prefRes.status, 200);
    assert.strictEqual(prefRes.data.preferences.nomeAmigo, 'Léo');

    const renameRes = await requestJson(baseUrl, '/preferences/friend-name', {
      method: 'PATCH',
      token: tokenA,
      body: { nomeAmigo: 'Bia' },
    });
    assert.strictEqual(renameRes.status, 200);
    assert.strictEqual(renameRes.data.preferences.nomeAmigo, 'Bia');

    const themeRes = await requestJson(baseUrl, '/preferences/theme', {
      method: 'PATCH',
      token: tokenA,
      body: { temaNoturno: true },
    });
    assert.strictEqual(themeRes.status, 200);
    assert.strictEqual(themeRes.data.preferences.temaNoturno, true);
    console.log('  ✔ Nome do amigo ("Léo" -> "Bia") e Modo Noturno (temaNoturno: true) validados.');

    console.log('▶ [FUNCIONAL 3/8] Pop-up de conversa imediata pós-Botão de Pânico...');
    const welcomeRes = await requestJson(baseUrl, '/chat/welcome', {
      method: 'POST',
      token: tokenA,
    });
    assert.strictEqual(welcomeRes.status, 201);
    assert.strictEqual(welcomeRes.data.friendName, 'Bia');
    assert.strictEqual(welcomeRes.data.message.remetente, 'FRIEND');
    assert.strictEqual(welcomeRes.data.message.criseRelacionada, true);
    console.log('  ✔ Mensagem inicial acolhedora gerada no pop-up de crise.');

    console.log('▶ [FUNCIONAL 4/8] Conversa por texto (sobrecarga + vontade de gritar/extravasar)...');
    const msgWorkRes = await requestJson(baseUrl, '/chat/message', {
      method: 'POST',
      token: tokenA,
      body: {
        tipo: 'TEXT',
        conteudoTexto:
          'Estou muito sobrecarregada no trabalho, muita cobrança do chefe e passei a noite com insônia sem conseguir dormir.',
        criseRelacionada: true,
      },
    });
    assert.strictEqual(msgWorkRes.status, 201);
    assert.strictEqual(msgWorkRes.data.friendMessage.remetente, 'FRIEND');

    const msgVentRes = await requestJson(baseUrl, '/chat/message', {
      method: 'POST',
      token: tokenA,
      body: {
        tipo: 'TEXT',
        conteudoTexto: 'Estou com muita raiva, quero gritar e extravasar toda essa pressão!',
        criseRelacionada: true,
      },
    });
    assert.strictEqual(msgVentRes.status, 201);
    assert.ok(
      msgVentRes.data.friendMessage.conteudoTexto.length > 20,
      'Amigo deve responder acolhendo a vontade de extravasar sem julgamento'
    );
    console.log('  ✔ Mensagens de texto e acolhimento para extravasar validados.');

    console.log('▶ [FUNCIONAL 5/8] Sugestões amplas do Amigo (Filmes, Livros, Músicas, Exercícios e Caminhadas)...');
    const msgSuggestRes = await requestJson(baseUrl, '/chat/message', {
      method: 'POST',
      token: tokenA,
      body: {
        tipo: 'TEXT',
        conteudoTexto: 'Me sugere filmes, livros, músicas, exercícios ou uma caminhada para distrair a mente.',
        criseRelacionada: true,
      },
    });
    assert.strictEqual(msgSuggestRes.status, 201);
    const replyLower = (msgSuggestRes.data.friendMessage.conteudoTexto as string).toLowerCase();
    assert.ok(
      replyLower.includes('filme') &&
        replyLower.includes('livro') &&
        replyLower.includes('música') &&
        replyLower.includes('exercício') &&
        replyLower.includes('caminhada'),
      'A resposta do amigo deve incluir sugestões práticas de filmes, livros, músicas, exercícios e caminhadas'
    );
    console.log('  ✔ Sugestões práticas de filmes, livros, músicas, exercícios e caminhadas validadas.');

    console.log('▶ [FUNCIONAL 6/8] Envio de áudio estilo WhatsApp...');
    const sampleAudioDataUri = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////';
    const audioRes = await requestJson(baseUrl, '/chat/message', {
      method: 'POST',
      token: tokenA,
      body: {
        tipo: 'AUDIO',
        conteudoTexto: 'Desabafo em voz alta sobre ansiedade e falta de ar no peito',
        audioUrl: sampleAudioDataUri,
        audioDuration: 9,
        criseRelacionada: true,
      },
    });
    assert.strictEqual(audioRes.status, 201);
    assert.strictEqual(audioRes.data.userMessage.tipo, 'AUDIO');
    assert.strictEqual(audioRes.data.userMessage.audioDuration, 9);
    console.log('  ✔ Gravação e persistência de mensagem de áudio estilo WhatsApp validadas.');

    console.log('▶ [FUNCIONAL 7/8] Sincronização de fila offline (IndexedDB -> Backend)...');
    const syncRes = await requestJson(baseUrl, '/chat/sync', {
      method: 'POST',
      token: tokenA,
      body: {
        messages: [
          {
            tipo: 'TEXT',
            conteudoTexto: 'Mensagem escrita quando eu estava sem internet no celular.',
            criseRelacionada: false,
          },
        ],
      },
    });
    assert.strictEqual(syncRes.status, 200);
    assert.strictEqual(syncRes.data.synced.length, 1);
    console.log('  ✔ Sincronização offline concluída com sucesso.');

    console.log('▶ [FUNCIONAL 8/8] Relatório para PDF com indicação/diagnóstico de gatilhos...');
    const reportRes = await requestJson(baseUrl, '/chat/report-data', {
      token: tokenA,
    });
    assert.strictEqual(reportRes.status, 200);
    const report = reportRes.data.report;
    assert.strictEqual(report.friendName, 'Bia');
    assert.ok(report.days.length >= 1, 'Deve agrupar as conversas por data');
    assert.ok(
      report.topTriggers.length >= 2,
      'Deve identificar os gatilhos conversados (trabalho, sono, extravasar, ansiedade)'
    );
    assert.ok(
      report.days[0].dailySynthesis.includes('houve conversa sobre'),
      'Deve conter a síntese diária explicando os fatores que desencadearam a crise'
    );
    assert.ok(
      report.practicalSuggestions?.filmes?.length >= 1 &&
        report.practicalSuggestions?.livros?.length >= 1 &&
        report.practicalSuggestions?.caminhadas?.length >= 1,
      'Relatório deve incluir sugestões práticas (filmes, livros, músicas, exercícios e caminhadas)'
    );
    console.log('  ✔ Relatório estruturado com indicação de gatilhos e plano prático validado.');

    // =========================================================================
    // 2. TESTES DE VULNERABILIDADE E SEGURANÇA
    // =========================================================================
    console.log('\n🔒 [SEGURANÇA 1/5] Bloqueio de acesso não autenticado a rotas privadas...');
    const unauthHistory = await requestJson(baseUrl, '/chat/history');
    const unauthReport = await requestJson(baseUrl, '/chat/report-data');
    assert.strictEqual(unauthHistory.status, 401);
    assert.strictEqual(unauthReport.status, 401);
    console.log('  ✔ Rotas privadas bloqueiam requisições sem JWT válido (401).');

    console.log('🔒 [SEGURANÇA 2/5] Prevenção contra IDOR (Isolamento entre usuários)...');
    const userBEmail = `teste.idor.${Date.now()}@respira.local`;
    testEmails.push(userBEmail);

    const regB = await requestJson(baseUrl, '/auth/register', {
      method: 'POST',
      body: {
        nome: 'Carlos Outro',
        email: userBEmail,
        senha: 'SenhaForte123!',
        dataNascimento: '1995-02-10',
        captchaToken: solveInternalCaptcha(),
      },
    });
    const tokenB = regB.data.token as string;

    const reportB = await requestJson(baseUrl, '/chat/report-data', { token: tokenB });
    assert.strictEqual(reportB.status, 200);
    assert.strictEqual(
      reportB.data.report.totalMessages,
      0,
      'Usuário B NÃO pode ver nenhuma mensagem ou relatório do Usuário A (Zero IDOR)'
    );
    console.log('  ✔ Isolamento estrito de dados entre usuários confirmado (Zero IDOR).');

    console.log('🔒 [SEGURANÇA 3/5] Sanitização contra XSS no nome do amigo e entradas...');
    const xssNameRes = await requestJson(baseUrl, '/preferences/friend-name', {
      method: 'PATCH',
      token: tokenA,
      body: { nomeAmigo: '<script>alert("xss")</script>Rafa' },
    });
    assert.strictEqual(xssNameRes.status, 200);
    assert.ok(
      !xssNameRes.data.preferences.nomeAmigo.includes('<') &&
        !xssNameRes.data.preferences.nomeAmigo.includes('>'),
      'Caracteres perigosos de tags HTML devem ser removidos do nome do amigo'
    );
    console.log('  ✔ Sanitização contra injeção de tags/scripts no perfil validada.');

    console.log('🔒 [SEGURANÇA 4/5] Rejeição de payloads maliciosos ou abusivos de áudio...');
    const invalidAudioMime = await requestJson(baseUrl, '/chat/message', {
      method: 'POST',
      token: tokenA,
      body: {
        tipo: 'AUDIO',
        conteudoTexto: 'Tentativa de URI maliciosa',
        audioUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      },
    });
    assert.strictEqual(
      invalidAudioMime.status,
      400,
      'Deve rejeitar data URI que não seja audio/* (400)'
    );
    console.log('  ✔ Validação estrita de MIME Type de áudio confirmada.');

    console.log('🔒 [SEGURANÇA 5/5] Verificação de não exposição de chaves secretas no Frontend...');
    const frontendSrcDir = path.resolve(__dirname, '../../../frontend/src');
    const forbiddenSecrets = [
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
      'JWT_SECRET',
      'CAPTCHA_SECRET',
      'RESEND_API_KEY',
      'DATABASE_URL',
    ];

    function scanDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const secretName of forbiddenSecrets) {
            assert.ok(
              !content.includes(secretName),
              `Segredo de backend ${secretName} encontrado indevidamente em ${fullPath}`
            );
          }
        }
      }
    }

    scanDir(frontendSrcDir);
    console.log('  ✔ Nenhuma chave secreta de backend exposta no código do Frontend.');

    console.log('🔒 [SEGURANÇA 6/6] Blindagem de arquivos .env e credenciais no .gitignore...');
    const rootGitignorePath = path.resolve(__dirname, '../../../.gitignore');
    const backendGitignorePath = path.resolve(__dirname, '../../.gitignore');
    const frontendGitignorePath = path.resolve(__dirname, '../../../frontend/.gitignore');

    assert.ok(fs.existsSync(rootGitignorePath), '.gitignore na raiz deve existir');
    assert.ok(fs.existsSync(backendGitignorePath), 'backend/.gitignore deve existir');
    assert.ok(fs.existsSync(frontendGitignorePath), 'frontend/.gitignore deve existir');

    const rootGitignoreContent = fs.readFileSync(rootGitignorePath, 'utf8');
    assert.ok(
      rootGitignoreContent.includes('.env') &&
        rootGitignoreContent.includes('.env.*') &&
        rootGitignoreContent.includes('*.pem') &&
        rootGitignoreContent.includes('*.key'),
      '.gitignore deve bloquear arquivos .env, .env.*, certificados e chaves'
    );
    console.log('  ✔ Arquivos .gitignore (raiz, /backend e /frontend) auditados e blindados.');

    console.log('\n✅ TODOS OS 14 TESTES (8 FUNCIONAIS + 6 DE SEGURANÇA) PASSARAM COM SUCESSO!');
  } finally {
    if (testEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: testEmails } },
      });
    }
    server.close();
    await prisma.$disconnect();
  }
}

runSuite().catch((err) => {
  console.error('❌ Falha na suíte de testes:', err);
  process.exit(1);
});
