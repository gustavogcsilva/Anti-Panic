import crypto from 'crypto';
import { PrismaClient, UserPreferences } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { verifyCaptchaToken } from '../utils/captcha';
import { comparePassword, hashPassword } from '../utils/hash';
import { signAuthToken } from '../utils/jwt';
import { EmailService } from './email.service';

export interface RegisterInput {
  nome: string;
  email: string;
  senha: string;
  dataNascimento: string;
  captchaToken: string;
}

export interface LoginInput {
  email: string;
  senha: string;
  captchaToken: string;
}

export interface ResetPasswordInput {
  token: string;
  novaSenha: string;
}

export interface SerializedUser {
  id: string;
  nome: string;
  email: string;
  dataNascimento: string;
  hasPreferences: boolean;
  preferences: {
    generosMusicais: string[];
    artistasPreferidos: string[];
    modoAleatorio: boolean;
    contatoEmergenciaNome: string | null;
    contatoEmergenciaTelefone: string | null;
  } | null;
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function hasConfiguredPreferences(prefs: UserPreferences | null): boolean {
  if (!prefs) return false;
  return (
    prefs.modoAleatorio ||
    prefs.generosMusicais.length > 0 ||
    prefs.artistasPreferidos.length > 0
  );
}

function serializeUser(user: {
  id: string;
  nome: string;
  email: string;
  dataNascimento: Date;
  preferences: UserPreferences | null;
}): SerializedUser {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    dataNascimento: user.dataNascimento.toISOString().slice(0, 10),
    hasPreferences: hasConfiguredPreferences(user.preferences),
    preferences: user.preferences
      ? {
          generosMusicais: user.preferences.generosMusicais,
          artistasPreferidos: user.preferences.artistasPreferidos,
          modoAleatorio: user.preferences.modoAleatorio,
          contatoEmergenciaNome: user.preferences.contatoEmergenciaNome,
          contatoEmergenciaTelefone: user.preferences.contatoEmergenciaTelefone,
        }
      : null,
  };
}

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly emailService = new EmailService()
  ) {}

  public async register(input: RegisterInput): Promise<{ token: string; user: SerializedUser }> {
    if (!verifyCaptchaToken(input.captchaToken)) {
      throw new AppError('Verificação anti-robô inválida ou expirada. Tente novamente.', 400);
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const parsedBirthDate = new Date(`${input.dataNascimento}T00:00:00.000Z`);

    if (Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate > new Date()) {
      throw new AppError('Data de nascimento inválida.', 400);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new AppError('Já existe uma conta cadastrada com este e-mail.', 409);
    }

    const senhaHash = await hashPassword(input.senha);

    const createdUser = await this.prisma.user.create({
      data: {
        nome: input.nome.trim(),
        email: normalizedEmail,
        senhaHash,
        dataNascimento: parsedBirthDate,
      },
      include: { preferences: true },
    });

    const token = signAuthToken({
      sub: createdUser.id,
      email: createdUser.email,
    });

    return {
      token,
      user: serializeUser(createdUser),
    };
  }

  public async login(input: LoginInput): Promise<{ token: string; user: SerializedUser }> {
    if (!verifyCaptchaToken(input.captchaToken)) {
      throw new AppError('Verificação anti-robô inválida ou expirada. Tente novamente.', 400);
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { preferences: true },
    });

    if (!user) {
      throw new AppError('E-mail ou senha incorretos.', 401);
    }

    const passwordMatches = await comparePassword(input.senha, user.senhaHash);

    if (!passwordMatches) {
      throw new AppError('E-mail ou senha incorretos.', 401);
    }

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
    });

    return {
      token,
      user: serializeUser(user),
    };
  }

  public async getAuthenticatedUser(userId: string): Promise<SerializedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });

    if (!user) {
      throw new AppError('Usuário não encontrado.', 404);
    }

    return serializeUser(user);
  }

  public async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, nome: true, email: true },
    });

    // Não revela se o e-mail existe para evitar enumeração de contas
    if (!user) {
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpires: expiresAt,
      },
    });

    const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;

    await this.emailService.sendPasswordResetEmail({
      to: user.email,
      nome: user.nome,
      resetUrl,
    });
  }

  public async resetPassword(input: ResetPasswordInput): Promise<void> {
    const hashedToken = hashResetToken(input.token.trim());

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
      select: { id: true },
    });

    if (!user) {
      throw new AppError(
        'Link de recuperação inválido ou expirado. Solicite um novo link.',
        400
      );
    }

    const newPasswordHash = await hashPassword(input.novaSenha);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        senhaHash: newPasswordHash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });
  }
}
