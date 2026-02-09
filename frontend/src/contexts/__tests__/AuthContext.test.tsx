import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../AuthContext";

vi.mock("@/api/auth.api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshTokens: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/api/users.api", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  default: {
    interceptors: {
      response: { use: vi.fn(() => 0), eject: vi.fn() },
    },
  },
}));

import * as authApi from "@/api/auth.api";
import * as usersApi from "@/api/users.api";

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user">{auth.user ? auth.user.username : "null"}</span>
      <span data-testid="error">{auth.error || "null"}</span>
      <button onClick={() => auth.login("testuser", "Password1")}>
        Login
      </button>
      <button
        onClick={() =>
          auth.register({
            email: "t@t.com",
            username: "test",
            firstName: "T",
            lastName: "U",
            password: "Password1",
          })
        }
      >
        Register
      </button>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function fakeJwt(sub: string): string {
  const payload = btoa(JSON.stringify({ sub }));
  return `header.${payload}.sig`;
}

const USER = {
  id: "user-1",
  username: "john",
  firstName: "John",
  lastName: "Doe",
  profilePictureUrl: null,
  language: "EN" as const,
};

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("starts unauthenticated when no token exists", async () => {
    renderWithAuth();

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("restores session from existing token on mount", async () => {
    localStorage.setItem("access_token", fakeJwt("user-1"));
    localStorage.setItem("refresh_token", "rt");
    vi.mocked(usersApi.getUser).mockResolvedValueOnce(USER);

    renderWithAuth();

    await waitFor(() =>
      expect(screen.getByTestId("authenticated").textContent).toBe("true"),
    );
    expect(screen.getByTestId("user").textContent).toBe("john");
    expect(usersApi.getUser).toHaveBeenCalledWith("user-1");
  });

  it("login stores tokens and fetches user", async () => {
    const token = fakeJwt("user-1");
    vi.mocked(authApi.login).mockResolvedValueOnce({
      access_token: token,
      refresh_token: "rt",
      token_type: "Bearer",
      expires_in: 900,
    });
    vi.mocked(usersApi.getUser).mockResolvedValueOnce(USER);

    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    await act(async () => {
      await userEvent.click(screen.getByText("Login"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("authenticated").textContent).toBe("true"),
    );
    expect(localStorage.getItem("access_token")).toBe(token);
    expect(localStorage.getItem("refresh_token")).toBe("rt");
    expect(screen.getByTestId("user").textContent).toBe("john");
  });

  it("register stores tokens and fetches user", async () => {
    const token = fakeJwt("user-1");
    vi.mocked(authApi.register).mockResolvedValueOnce({
      access_token: token,
      refresh_token: "rt",
      token_type: "Bearer",
      expires_in: 900,
    });
    vi.mocked(usersApi.getUser).mockResolvedValueOnce(USER);

    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    await act(async () => {
      await userEvent.click(screen.getByText("Register"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("authenticated").textContent).toBe("true"),
    );
    expect(localStorage.getItem("access_token")).toBe(token);
  });

  it("logout clears tokens and state", async () => {
    localStorage.setItem("access_token", fakeJwt("user-1"));
    localStorage.setItem("refresh_token", "rt");
    vi.mocked(usersApi.getUser).mockResolvedValueOnce(USER);
    vi.mocked(authApi.logout).mockResolvedValueOnce({
      message: "Logged out successfully",
    });

    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("authenticated").textContent).toBe("true"),
    );

    await act(async () => {
      await userEvent.click(screen.getByText("Logout"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("authenticated").textContent).toBe("false"),
    );
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
});
