import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../AuthContext";

vi.mock("@/api/auth.api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/api/users.api", () => ({
  getMe: vi.fn(),
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
    document.cookie = "has_session=; max-age=0; path=/";
  });

  it("starts unauthenticated when no session cookie exists", async () => {
    renderWithAuth();

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("null");
    expect(usersApi.getMe).not.toHaveBeenCalled();
  });

  it("restores session from existing cookie on mount", async () => {
    document.cookie = "has_session=1";
    vi.mocked(usersApi.getMe).mockResolvedValueOnce(USER);

    renderWithAuth();

    await waitFor(() =>
      expect(screen.getByTestId("authenticated").textContent).toBe("true"),
    );
    expect(screen.getByTestId("user").textContent).toBe("john");
    expect(usersApi.getMe).toHaveBeenCalled();
  });

  it("login calls api and fetches user", async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({ message: "Logged in successfully" });
    vi.mocked(usersApi.getMe).mockResolvedValueOnce(USER);

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
    expect(usersApi.getMe).toHaveBeenCalled();
    expect(screen.getByTestId("user").textContent).toBe("john");
  });

  it("register calls api without opening a session (email verification required)", async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({
      message: "Registration successful. Please check your email to verify your account.",
    });

    renderWithAuth();
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    await act(async () => {
      await userEvent.click(screen.getByText("Register"));
    });

    await waitFor(() => expect(authApi.register).toHaveBeenCalled());
    // No session until the user verifies their email.
    expect(usersApi.getMe).not.toHaveBeenCalled();
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("logout clears user state", async () => {
    document.cookie = "has_session=1";
    vi.mocked(usersApi.getMe).mockResolvedValueOnce(USER);
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
    expect(screen.getByTestId("user").textContent).toBe("null");
  });
});
