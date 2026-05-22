import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthLogin } from "../auth/AuthLogin";

const navigate = vi.fn();
const login = vi.fn();
const clearError = vi.fn();
let authError: string | null = null;

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ login, error: authError, clearError }),
}));

vi.mock("../auth/OAuthProviders", () => ({
  OAuthProviders: () => <div data-testid="oauth-providers" />,
}));

describe("AuthLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authError = null;
  });

  it("renders the login form", () => {
    render(<AuthLogin dispatch={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("username_placeholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("password_placeholder"),
    ).toBeInTheDocument();
  });

  it("blocks submission and shows an error when fields are empty", async () => {
    render(<AuthLogin dispatch={vi.fn()} />);

    await userEvent.click(screen.getByText("signin"));

    expect(screen.getByText("please_fill_all_fields")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("logs in and navigates to the dashboard on success", async () => {
    login.mockResolvedValue(undefined);
    render(<AuthLogin dispatch={vi.fn()} />);

    await userEvent.type(
      screen.getByPlaceholderText("username_placeholder"),
      "john",
    );
    await userEvent.type(
      screen.getByPlaceholderText("password_placeholder"),
      "Password1",
    );
    await userEvent.click(screen.getByText("signin"));

    expect(login).toHaveBeenCalledWith("john", "Password1");
    expect(navigate).toHaveBeenCalledWith("/dashboard");
  });

  it("translates the 'invalid credentials' auth error", () => {
    authError = "Invalid credentials";
    render(<AuthLogin dispatch={vi.fn()} />);
    expect(screen.getByText("error_invalid_credentials")).toBeInTheDocument();
  });

  it("translates the 'email not verified' auth error", () => {
    authError = "Please verify your email before logging in";
    render(<AuthLogin dispatch={vi.fn()} />);
    expect(screen.getByText("error_email_not_verified")).toBeInTheDocument();
  });

  it("dispatches navigation to the forgot-password and identify steps", async () => {
    const dispatch = vi.fn();
    render(<AuthLogin dispatch={dispatch} />);

    await userEvent.click(screen.getByText("forgot_password"));
    await userEvent.click(screen.getByText("back"));

    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
