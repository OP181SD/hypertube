import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import VerifyEmailPage from "../VerifyEmailPage";

const navigate = vi.fn();
const verifyEmail = vi.fn();
const resendVerification = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ verifyEmail, resendVerification }),
}));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <VerifyEmailPage />
    </MemoryRouter>,
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies the token from the URL and shows the success state", async () => {
    verifyEmail.mockResolvedValue(undefined);
    renderAt("/verify-email?token=abc123");

    await waitFor(() =>
      expect(screen.getByText("verify_email_success")).toBeInTheDocument(),
    );
    expect(verifyEmail).toHaveBeenCalledWith("abc123");
  });

  it("shows the error state when verification fails", async () => {
    verifyEmail.mockRejectedValue(new Error("invalid"));
    renderAt("/verify-email?token=bad");

    await waitFor(() =>
      expect(screen.getByText("verify_email_failed")).toBeInTheDocument(),
    );
  });

  it("shows the error state immediately when no token is present", async () => {
    renderAt("/verify-email");

    await waitFor(() =>
      expect(screen.getByText("verify_email_failed")).toBeInTheDocument(),
    );
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it("lets the user resend a verification link from the error state", async () => {
    verifyEmail.mockRejectedValue(new Error("invalid"));
    resendVerification.mockResolvedValue(undefined);
    renderAt("/verify-email?token=bad");

    await waitFor(() =>
      expect(screen.getByText("verify_email_failed")).toBeInTheDocument(),
    );

    await userEvent.type(
      screen.getByPlaceholderText("email_placeholder"),
      "user@example.com",
    );
    await userEvent.click(screen.getByText("resend_verification"));

    await waitFor(() =>
      expect(screen.getByText("resend_verification_done")).toBeInTheDocument(),
    );
    expect(resendVerification).toHaveBeenCalledWith("user@example.com");
  });
});
