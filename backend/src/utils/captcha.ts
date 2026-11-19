import crypto from 'crypto';
import { env } from '../config/env';

const CAPTCHA_TTL_MS = 10 * 60 * 1000; // 10 minutos

interface CaptchaChallengePayload {
  nonce: string;
  expectedAnswer: number;
  expiresAt: number;
}

export interface CaptchaChallengeResponse {
  question: string;
  challengeToken: string;
  expiresAt: number;
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', env.CAPTCHA_SECRET)
    .update(encodedPayload)
    .digest('base64url');
}

/**
 * Gera um desafio matemático simples e acessível assinado por HMAC no servidor.
 * Formato do token enviado pelo cliente após resolver: "<encodedPayload>.<signature>:<userAnswer>"
 */
export function createCaptchaChallenge(): CaptchaChallengeResponse {
  const a = crypto.randomInt(2, 10);
  const b = crypto.randomInt(1, 9);
  const expectedAnswer = a + b;
  const expiresAt = Date.now() + CAPTCHA_TTL_MS;

  const payload: CaptchaChallengePayload = {
    nonce: crypto.randomBytes(12).toString('hex'),
    expectedAnswer,
    expiresAt,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signPayload(encodedPayload);

  return {
    question: `Quanto é ${a} + ${b}?`,
    challengeToken: `${encodedPayload}.${signature}`,
    expiresAt,
  };
}

/**
 * Valida o captchaToken no formato "<encodedPayload>.<signature>:<answer>".
 * Garante integridade criptográfica (HMAC + timingSafeEqual), expiração e resposta correta.
 */
export function verifyCaptchaToken(captchaToken: string): boolean {
  if (!captchaToken || typeof captchaToken !== 'string') {
    return false;
  }

  const separatorIndex = captchaToken.lastIndexOf(':');
  if (separatorIndex <= 0) {
    return false;
  }

  const signedChallenge = captchaToken.slice(0, separatorIndex);
  const rawAnswer = captchaToken.slice(separatorIndex + 1).trim();
  const parsedAnswer = Number(rawAnswer);

  if (!Number.isInteger(parsedAnswer)) {
    return false;
  }

  const parts = signedChallenge.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [encodedPayload, providedSignature] = parts;
  const expectedSignature = signPayload(encodedPayload);

  const providedBuffer = Buffer.from(providedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as CaptchaChallengePayload;

    if (Date.now() > payload.expiresAt) {
      return false;
    }

    return payload.expectedAnswer === parsedAnswer;
  } catch {
    return false;
  }
}
