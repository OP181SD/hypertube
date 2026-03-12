import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../auth/ProtectedRoute";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";
import { updateUser } from "@/api/users.api";

const mockUseAuth = vi.mocked(useAuth);

const AUTH_BASE = {
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  restoreSession: vi.fn(),
  updateUser: vi.fn(),
  refreshUser: vi.fn(),
  clearError: vi.fn(),
};

describe("ProtectedRoute", () => {
  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      ...AUTH_BASE,
      isAuthenticated: true,
      loading: false,
      user: {
        id: "1",
        username: "test",
        firstName: "T",
        lastName: "U",
        profilePictureUrl: null,
        language: "EN",
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects to / when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      ...AUTH_BASE,
      isAuthenticated: false,
      loading: false,
      user: null,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("shows loading spinner when loading", () => {
    mockUseAuth.mockReturnValue({
      ...AUTH_BASE,
      isAuthenticated: false,
      loading: true,
      user: null,
      error: null,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });
});
