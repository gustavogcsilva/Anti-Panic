import { neonConfig, Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();
neonConfig.webSocketConstructor = ws;

const ddl = `
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "reset_token" VARCHAR(128),
    "reset_token_expires" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nome_amigo" VARCHAR(60) NOT NULL DEFAULT 'Amigo',
    "generos_musicais" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "artistas_preferidos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modo_aleatorio" BOOLEAN NOT NULL DEFAULT false,
    "contato_emergencia_nome" VARCHAR(120),
    "contato_emergencia_telefone" VARCHAR(32),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_preferences"
    ADD COLUMN IF NOT EXISTS "nome_amigo" VARCHAR(60) NOT NULL DEFAULT 'Amigo';

ALTER TABLE "user_preferences"
    ADD COLUMN IF NOT EXISTS "tema_noturno" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "panic_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "track_id" VARCHAR(100),
    "track_title" VARCHAR(255) NOT NULL,
    "track_artist" VARCHAR(255),
    "track_url" TEXT,
    "was_offline" BOOLEAN NOT NULL DEFAULT false,
    "duration_seconds" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "panic_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "titulo" VARCHAR(180),
    "crise_relacionada" BOOLEAN NOT NULL DEFAULT false,
    "resumo_gatilhos" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "user_id" UUID NOT NULL,
    "remetente" VARCHAR(16) NOT NULL,
    "tipo" VARCHAR(16) NOT NULL DEFAULT 'TEXT',
    "conteudo_texto" TEXT NOT NULL,
    "audio_url" TEXT,
    "audio_duration" INTEGER,
    "crise_relacionada" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_reset_token_idx" ON "users"("reset_token");
CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_id_key" ON "user_preferences"("user_id");
CREATE INDEX IF NOT EXISTS "panic_logs_user_id_triggered_at_idx" ON "panic_logs"("user_id", "triggered_at" DESC);
CREATE INDEX IF NOT EXISTS "chat_sessions_user_id_criado_em_idx" ON "chat_sessions"("user_id", "criado_em" DESC);
CREATE INDEX IF NOT EXISTS "chat_messages_user_id_criado_em_idx" ON "chat_messages"("user_id", "criado_em" ASC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_user_id_fkey'
    ) THEN
        ALTER TABLE "user_preferences"
            ADD CONSTRAINT "user_preferences_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'panic_logs_user_id_fkey'
    ) THEN
        ALTER TABLE "panic_logs"
            ADD CONSTRAINT "panic_logs_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_user_id_fkey'
    ) THEN
        ALTER TABLE "chat_sessions"
            ADD CONSTRAINT "chat_sessions_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_user_id_fkey'
    ) THEN
        ALTER TABLE "chat_messages"
            ADD CONSTRAINT "chat_messages_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_session_id_fkey'
    ) THEN
        ALTER TABLE "chat_messages"
            ADD CONSTRAINT "chat_messages_session_id_fkey"
            FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definida no .env');
  }

  console.log('🌐 Conectando ao Neon PostgreSQL via WebSockets (porta 443)...');
  const pool = new Pool({ connectionString });

  try {
    await pool.query(ddl);
    const { rows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`
    );
    console.log(
      '✅ Schema sincronizado com sucesso no Neon! Tabelas ativas:',
      rows.map((r) => r.tablename).join(', ')
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Erro ao aplicar schema no Neon:', err);
  process.exit(1);
});
