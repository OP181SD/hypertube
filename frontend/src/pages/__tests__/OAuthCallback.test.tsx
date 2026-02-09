import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockRestoreSession = vi.fn().mockResolvedValue(undefined);
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ restoreSession: mockRestoreSession }),
}));

import OAuthCallback from "../OAuthCallback";

describe("OAuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("stores tokens from URL and navigates to /dashboard", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/auth/callback?access_token=at123&refresh_token=rt456",
        ]}
      >
        <OAuthCallback />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(localStorage.getItem("access_token")).toBe("at123");
      expect(localStorage.getItem("refresh_token")).toBe("rt456");
      expect(mockRestoreSession).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
        replace: true,
      });
    });
  });

  it("redirects to / if no tokens in URL", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <OAuthCallback />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });
});
