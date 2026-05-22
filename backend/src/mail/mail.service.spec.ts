import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { MailService } from "./mail.service";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSendMail = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ messageId: "test-id" }),
);

vi.mock("nodemailer", () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: mockSendMail,
  }),
}));

import * as nodemailer from "nodemailer";

const mockConfigService = {
  get: vi.fn((key: string, defaultValue?: unknown) => {
    const config: Record<string, unknown> = {
      SMTP_HOST: "smtp.test.com",
      SMTP_PORT: 587,
      SMTP_USER: "test-user",
      SMTP_PASS: "test-pass",
      MAIL_FROM: "HyperTube <noreply@test.com>",
    };
    return config[key] ?? defaultValue;
  }),
};

describe("MailService", () => {
  let service: MailService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should create nodemailer transport from SMTP config", () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.test.com",
        port: 587,
        auth: { user: "test-user", pass: "test-pass" },
      }),
    );
  });

  describe("sendPasswordReset", () => {
    it("should send email with correct parameters", async () => {
      await service.sendPasswordReset(
        "user@example.com",
        "testuser",
        "http://localhost:5173/reset-password?token=abc123",
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "HyperTube - Password Reset",
          html: expect.stringContaining("testuser"),
        }),
      );
    });

    it("should include reset link in email", async () => {
      await service.sendPasswordReset(
        "user@example.com",
        "testuser",
        "http://localhost:5173/reset-password?token=abc123",
      );

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("http://localhost:5173/reset-password?token=abc123");
    });
  });

  describe("sendVerificationEmail", () => {
    it("should send verification email with correct parameters", async () => {
      await service.sendVerificationEmail(
        "user@example.com",
        "testuser",
        "http://localhost:5173/verify-email?token=xyz789",
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "HyperTube - Verify your email",
          html: expect.stringContaining("testuser"),
        }),
      );
    });

    it("should include verification link in email", async () => {
      await service.sendVerificationEmail(
        "user@example.com",
        "testuser",
        "http://localhost:5173/verify-email?token=xyz789",
      );

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain("http://localhost:5173/verify-email?token=xyz789");
    });
  });
});
