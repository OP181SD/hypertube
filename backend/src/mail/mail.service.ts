import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import * as handlebars from "handlebars";
import { readFileSync } from "fs";
import { join } from "path";

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(private readonly configService: ConfigService) {
    const smtpUser = this.configService.get<string>("SMTP_USER");
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("SMTP_HOST"),
      port: this.configService.get<number>("SMTP_PORT"),
      ...(smtpUser ? { auth: { user: smtpUser, pass: this.configService.get<string>("SMTP_PASS") } } : {}),
    });

    this.from = this.configService.get<string>("MAIL_FROM", "noreply@hypertube.local");
  }

  async sendPasswordReset(
    email: string,
    username: string,
    resetLink: string,
  ): Promise<void> {
    const templatePath = join(__dirname, "templates", "password-reset.hbs");

    let html: string;
    try {
      const templateSource = readFileSync(templatePath, "utf-8");
      const template = handlebars.compile(templateSource);
      html = template({ username, resetLink });
    } catch {
      // Fallback to simple HTML if template not found
      html = `
        <h1>Password Reset</h1>
        <p>Hi ${username},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: "HyperTube - Password Reset",
      html,
    });
  }
}
