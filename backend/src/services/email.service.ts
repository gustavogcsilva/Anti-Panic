import { Resend } from 'resend';
import { env } from '../config/env';

export class EmailService {
  private readonly resend: Resend | null;

  constructor() {
    this.resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  }

  public async sendPasswordResetEmail(params: {
    to: string;
    nome: string;
    resetUrl: string;
  }): Promise<void> {
    const { to, nome, resetUrl } = params;

    if (!this.resend) {
      if (env.NODE_ENV === 'production') {
        throw new Error('RESEND_API_KEY não configurada em ambiente de produção.');
      }

      console.warn(
        `[DEV EMAIL] RESEND_API_KEY ausente. Link de recuperação para ${to}: ${resetUrl}`
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: env.EMAIL_FROM,
      to: [to],
      subject: 'Recuperação de senha — Respira PWA',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background-color: #f8fafc; color: #1e293b; border-radius: 16px;">
          <h2 style="margin: 0 0 12px; color: #0f766e; font-size: 22px;">Olá, ${nome}</h2>
          <p style="margin: 0 0 16px; line-height: 1.6; font-size: 15px;">
            Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Respira</strong>.
          </p>
          <p style="margin: 0 0 24px; line-height: 1.6; font-size: 15px;">
            Clique no botão abaixo para criar uma nova senha. Este link expira em <strong>1 hora</strong>.
          </p>
          <a
            href="${resetUrl}"
            style="display: inline-block; padding: 14px 24px; background-color: #0d9488; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;"
          >
            Redefinir minha senha
          </a>
          <p style="margin: 24px 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
            Se você não solicitou esta alteração, pode ignorar este e-mail com tranquilidade. Sua senha atual continuará segura.
          </p>
          <p style="margin: 12px 0 0; font-size: 12px; color: #94a3b8; word-break: break-all;">
            Link direto: ${resetUrl}
          </p>
        </div>
      `,
    });

    if (error) {
      throw new Error(`Falha ao enviar e-mail pelo Resend: ${error.message}`);
    }
  }
}
