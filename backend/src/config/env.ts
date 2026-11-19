import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('30d'),
  CAPTCHA_SECRET: z
    .string()
    .min(16)
    .default('dev-captcha-secret-alterar-em-producao-32-chars'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Respira PWA <onboarding@resend.dev>'),
  JAMENDO_CLIENT_ID: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
