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
  });

  it("calls restoreSession and navigates to /dashboard", async () => {
    render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <OAuthCallback />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockRestoreSession).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
        replace: true,
      });
    });
  });
});
