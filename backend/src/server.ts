import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Backend Respira PWA rodando em http://localhost:${env.PORT}`);
});

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n${signal} recebido. Encerrando servidor com segurança...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
