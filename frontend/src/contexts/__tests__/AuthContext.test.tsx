import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
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
  updateUser: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  default: {
    interceptors: { response: { use: vi.fn(() => 0), eject: vi.fn() } },
  },
}));

import * as authApi from "@/api/auth.api";
import * as usersApi from "@/api/users.api";

const USER = {
  id: "user-1",
  username: "john",
  firstName: "John",
  lastName: "Doe",
  profilePictureUrl: null,
  language: "EN" as const,
};

const authRef = { current: null as unknown as ReturnType<typeof useAuth> };

function TestConsumer() {
  // Test-only escape hatch: expose the hook value so assertions can call its
  // methods outside the component tree.
  // eslint-disable-next-line react-hooks/immutability
  authRef.current = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(authRef.current.loading)}</span>
      <span data-testid="authenticated">
        {String(authRef.current.isAuthenticated)}
      </span>
      <span data-testid="user">
        {authRef.current.user ? authRef.current.user.username : "null"}
      </span>
      <span data-testid="error">{authRef.current.error || "null"}</span>
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

async function renderReady() {
  renderWithAuth();
  await waitFor(() =>
    expect(screen.getByTestId("loading").textContent).toBe("false"),
  );
}

async function renderLoggedIn() {
  document.cookie = "has_session=1";
  vi.mocked(usersApi.getMe).mockResolvedValueOnce(USER);
  renderWithAuth();
  await waitFor(() =>
    expect(screen.getByTestId("authenticated").textContent).toBe("true"),
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "has_session=; max-age=0; path=/";
  });

  it("starts unauthenticated when no session cookie exists", async () => {
    await renderReady();
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(usersApi.getMe).not.toHaveBeenCalled();
  });

  it("restores the session from an existing cookie on mount", async () => {
    await renderLoggedIn();
    expect(screen.getByTestId("user").textContent).toBe("john");
    expect(usersApi.getMe).toHaveBeenCalled();
  });

  it("clears state when session restoration fails", async () => {
    document.cookie = "has_session=1";
    vi.mocked(usersApi.getMe).mockRejectedValueOnce(new Error("expired"));

    await renderReady();

    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("login authenticates and loads the user", async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({ message: "ok" });
    vi.mocked(usersApi.getMe).mockResolvedValueOnce(USER);
    await renderReady();

    await act(async () => {
      await authRef.current.login("john", "Password1");
    });

    expect(authApi.login).toHaveBeenCalledWith({
      username: "john",
      password: "Password1",
    });
    expect(screen.getByTestId("authenticated").textContent).toBe("true");
  });

  it("login surfaces the backend error message and rethrows", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({
      response: { data: { message: "Invalid credentials" } },
    });
    await renderReady();

    await act(async () => {
      await expect(authRef.current.login("john", "bad")).rejects.toBeDefined();
    });

    expect(screen.getByTestId("error").textContent).toBe("Invalid credentials");
  });

  it("register calls the API without opening a session", async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({ message: "check email" });
    await renderReady();

    await act(async () => {
      await authRef.current.register({
        email: "t@t.com",
        username: "test",
        firstName: "T",
        lastName: "U",
        password: "Password1",
      });
    });

    expect(authApi.register).toHaveBeenCalled();
    expect(usersApi.getMe).not.toHaveBeenCalled();
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("verifyEmail authenticates and loads the user", async () => {
    vi.mocked(authApi.verifyEmail).mockResolvedValueOnce({ message: "verified" });
    vi.mocked(usersApi.getMe).mockResolvedValueOnce(USER);
    await renderReady();

    await act(async () => {
      await authRef.current.verifyEmail("valid-token");
    });

    expect(authApi.verifyEmail).toHaveBeenCalledWith("valid-token");
    expect(screen.getByTestId("authenticated").textContent).toBe("true");
  });

  it("verifyEmail surfaces the error and rethrows on an invalid token", async () => {
    vi.mocked(authApi.verifyEmail).mockRejectedValueOnce({
      response: { data: { message: "Invalid verification token" } },
    });
    await renderReady();

    await act(async () => {
      await expect(authRef.current.verifyEmail("bad")).rejects.toBeDefined();
    });

    expect(screen.getByTestId("error").textContent).toBe(
      "Invalid verification token",
    );
  });

  it("resendVerification delegates to the API", async () => {
    vi.mocked(authApi.resendVerification).mockResolvedValueOnce({
      message: "sent",
    });
    await renderReady();

    await act(async () => {
      await authRef.current.resendVerification("t@t.com");
    });

    expect(authApi.resendVerification).toHaveBeenCalledWith("t@t.com");
  });

  it("forgotPassword and resetPassword delegate to the API", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValueOnce({ message: "sent" });
    vi.mocked(authApi.resetPassword).mockResolvedValueOnce({ message: "reset" });
    await renderReady();

    await act(async () => {
      await authRef.current.forgotPassword("t@t.com");
      await authRef.current.resetPassword("token", "NewPass1");
    });

    expect(authApi.forgotPassword).toHaveBeenCalledWith("t@t.com");
    expect(authApi.resetPassword).toHaveBeenCalledWith("token", "NewPass1");
  });

  it("updateUser updates the stored user", async () => {
    await renderLoggedIn();
    vi.mocked(usersApi.updateUser).mockResolvedValueOnce({
      ...USER,
      username: "john2",
    });

    await act(async () => {
      await authRef.current.updateUser({ username: "john2" });
    });

    expect(usersApi.updateUser).toHaveBeenCalledWith("user-1", {
      username: "john2",
    });
    expect(screen.getByTestId("user").textContent).toBe("john2");
  });

  it("refreshUser reloads the user from the API", async () => {
    await renderLoggedIn();
    vi.mocked(usersApi.getUser).mockResolvedValueOnce({
      ...USER,
      username: "john-fresh",
    });

    await act(async () => {
      await authRef.current.refreshUser();
    });

    expect(usersApi.getUser).toHaveBeenCalledWith("user-1");
    expect(screen.getByTestId("user").textContent).toBe("john-fresh");
  });

  it("logout clears the user state", async () => {
    await renderLoggedIn();
    vi.mocked(authApi.logout).mockResolvedValueOnce({ message: "out" });

    await act(async () => {
      await authRef.current.logout();
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("clearError resets the error state", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({
      response: { data: { message: "Invalid credentials" } },
    });
    await renderReady();

    await act(async () => {
      await expect(authRef.current.login("x", "y")).rejects.toBeDefined();
    });
    expect(screen.getByTestId("error").textContent).toBe("Invalid credentials");

    await act(async () => {
      authRef.current.clearError();
    });
    expect(screen.getByTestId("error").textContent).toBe("null");
  });
});
