import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import * as handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("SMTP_HOST"),
      port: this.configService.get<number>("SMTP_PORT"),
      // auth is attached only when credentials are provided — local mail
      // catchers (mailpit, etc.) accept mail without authentication.
      ...(user ? { auth: { user, pass } } : {}),
    });

    this.from = this.configService.get<string>(
      "MAIL_FROM",
      "HyperTube <noreply@hypertube.local>",
    );
  }

  private renderTemplate(templateName: string, data: Record<string, string>): string {
    const templatePath = join(__dirname, "templates", `${templateName}.hbs`);
    try {
      const templateSource = readFileSync(templatePath, "utf-8");
      const template = handlebars.compile(templateSource);
      return template(data);
    } catch (err) {
      this.logger.error(`Failed to render email template "${templateName}": ${err}`);
      return `<p>Error loading email template.</p>`;
    }
  }

  async sendPasswordReset(email: string, username: string, resetLink: string): Promise<void> {
    const html = this.renderTemplate("password-reset", { username, resetLink });
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: "HyperTube - Password Reset",
        html,
      });
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}: ${err}`);
    }
  }

  async sendVerificationEmail(email: string, username: string, verificationLink: string): Promise<void> {
    const html = this.renderTemplate("verify-email", { username, verificationLink });
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: "HyperTube - Verify your email",
        html,
      });
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${email}: ${err}`);
    }
  }
}
