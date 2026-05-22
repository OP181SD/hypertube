import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignupForm } from "../useSignupForm";

const register = vi.fn();
const resendVerification = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ register, resendVerification, error: null }),
}));

const validFields: Record<string, string> = {
  username: "alice",
  firstName: "Alice",
  lastName: "Doe",
  email: "alice@example.com",
  password: "Password1",
  confirmPassword: "Password1",
};

function fill(
  result: { current: ReturnType<typeof useSignupForm> },
  fields: Record<string, string>,
) {
  for (const [key, value] of Object.entries(fields)) {
    act(() => result.current.setField(key as never)(value));
  }
}

describe("useSignupForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an incomplete form without calling register", async () => {
    const { result } = renderHook(() => useSignupForm());

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.displayError).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const { result } = renderHook(() => useSignupForm());
    fill(result, { ...validFields, email: "not-an-email" });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(register).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    const { result } = renderHook(() => useSignupForm());
    fill(result, { ...validFields, confirmPassword: "Different1" });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(register).not.toHaveBeenCalled();
  });

  it("registers and switches to the 'check your email' state on a valid form", async () => {
    register.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSignupForm());
    fill(result, validFields);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(register).toHaveBeenCalledWith({
      email: "alice@example.com",
      username: "alice",
      firstName: "Alice",
      lastName: "Doe",
      password: "Password1",
    });
    expect(result.current.registered).toBe(true);
  });

  it("stays unregistered when register throws", async () => {
    register.mockRejectedValue(new Error("conflict"));
    const { result } = renderHook(() => useSignupForm());
    fill(result, validFields);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.registered).toBe(false);
  });

  it("resends the verification email to the entered address", async () => {
    resendVerification.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSignupForm());
    fill(result, validFields);

    await act(async () => {
      await result.current.handleResend();
    });

    expect(resendVerification).toHaveBeenCalledWith("alice@example.com");
    expect(result.current.resendMessage).toBeTruthy();
  });
});
