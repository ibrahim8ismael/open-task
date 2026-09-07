import { Injectable, Logger } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";

interface MailInput {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;

  private configured(): boolean {
    return !!process.env.SMTP_HOST;
  }

  private transport(): Transporter | null {
    if (!this.configured()) return null;
    if (!this.transporter) {
      this.transporter = createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
    }
    return this.transporter;
  }

  fromAddress(): string {
    return process.env.SMTP_FROM ?? `Open-Task <no-reply@${(process.env.SMTP_HOST ?? "localhost").split(".")[0]}>`;
  }

  webBase(): string {
    return (process.env.WEB_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  }

  /** Send HTML mail. Never throws into the caller's request path. */
  async send(input: MailInput): Promise<boolean> {
    const t = this.transport();
    if (!t) {
      this.logger.log(`SMTP not configured; would send to ${input.to}: ${input.subject}`);
      return false;
    }
    try {
      await t.sendMail({ from: this.fromAddress(), ...input });
      return true;
    } catch (err) {
      this.logger.error(`mail send failed to ${input.to}: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }

  // --- templates ---

  async sendMagicCode(to: string, code: string): Promise<boolean> {
    return this.send({
      to,
      subject: `${code} is your Open-Task sign-in code`,
      html: `<p>Use this 6-digit code to sign in:</p><p style="font-size:28px;letter-spacing:6px"><b>${code}</b></p><p>The code expires in 10 minutes.</p>`,
    });
  }

  async sendPasswordReset(to: string, uid: string, token: string): Promise<boolean> {
    const link = `${this.webBase()}/accounts/reset-password/?uidb64=${uid}&token=${token}`;
    return this.send({
      to,
      subject: "Reset your Open-Task password",
      html: `<p>We received a request to reset your password.</p><p><a href="${link}">Choose a new password</a></p><p>The link expires in 1 hour. Ignore this email if you did not request it.</p>`,
    });
  }

  async sendWorkspaceInvite(to: string, workspaceName: string, inviterName: string): Promise<boolean> {
    const link = `${this.webBase()}/invitations/`;
    return this.send({
      to,
      subject: `${inviterName} invited you to ${workspaceName} on Open-Task`,
      html: `<p>${inviterName} has invited you to join <b>${workspaceName}</b>.</p><p><a href="${link}">Accept the invitation</a></p>`,
    });
  }

  async sendProjectInvite(to: string, projectName: string, inviterName: string): Promise<boolean> {
    const link = `${this.webBase()}/`;
    return this.send({
      to,
      subject: `${inviterName} added you to ${projectName}`,
      html: `<p>${inviterName} added you to the project <b>${projectName}</b> on Open-Task.</p><p><a href="${link}">Open Open-Task</a></p>`,
    });
  }

  async sendNotificationDigest(to: string, displayName: string, items: Array<{ title: string }>): Promise<boolean> {
    const list = items.map((i) => `<li>${i.title}</li>`).join("");
    return this.send({
      to,
      subject: `You have ${items.length} unread notification${items.length === 1 ? "" : "s"} on Open-Task`,
      html: `<p>Hi ${displayName || "there"}, here is what you missed:</p><ul>${list}</ul><p><a href="${this.webBase()}">Open Open-Task</a></p>`,
    });
  }
}
