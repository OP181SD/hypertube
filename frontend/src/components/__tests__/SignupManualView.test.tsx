import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupManualView } from "../auth/SignupManualView";

const handleSubmit = vi.fn();
const handleResend = vi.fn();
const setField = vi.fn(() => vi.fn());

const baseState = {
  fields: {
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  },
  setField,
  loading: false,
  displayError: "",
  handleSubmit,
  registered: false,
  handleResend,
  resendMessage: "",
};

let signupState: typeof baseState;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/hooks/useSignupForm", () => ({
  useSignupForm: () => signupState,
}));

describe("SignupManualView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signupState = { ...baseState };
  });

  it("renders the signup form when not yet registered", () => {
    render(<SignupManualView onBack={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("email_placeholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("create_password_placeholder"),
    ).toBeInTheDocument();
  });

  it("submits the form through handleSubmit", async () => {
    render(<SignupManualView onBack={vi.fn()} />);
    await userEvent.click(screen.getByText("continue"));
    expect(handleSubmit).toHaveBeenCalled();
  });

  it("calls onBack from the form view", async () => {
    const onBack = vi.fn();
    render(<SignupManualView onBack={onBack} />);
    await userEvent.click(screen.getByText("back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows the 'check your email' panel once registered", () => {
    signupState = { ...baseState, registered: true };
    render(<SignupManualView onBack={vi.fn()} />);
    expect(screen.getByText("check_email_title")).toBeInTheDocument();
  });

  it("resends the verification email from the registered panel", async () => {
    signupState = { ...baseState, registered: true };
    render(<SignupManualView onBack={vi.fn()} />);
    await userEvent.click(screen.getByText("resend_verification"));
    expect(handleResend).toHaveBeenCalled();
  });
});
