import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.email !== 'string'
  ) {
    throw new Error('Payload JWT inválido.');
  }

  return {
    sub: decoded.sub,
    email: decoded.email,
  };
}
