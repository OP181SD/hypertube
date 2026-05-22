import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProfileForm } from "../useProfileForm";

const updateUser = vi.fn();
const refreshUser = vi.fn();

const mockUser = {
  id: "u1",
  username: "alice",
  firstName: "Alice",
  lastName: "Doe",
  email: "alice@example.com",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, updateUser, refreshUser }),
}));

vi.mock("@/api/users.api", () => ({
  uploadProfilePicture: vi.fn(),
}));

import { uploadProfilePicture } from "@/api/users.api";

describe("useProfileForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("initialises the form from the current user", () => {
    const { result } = renderHook(() => useProfileForm());
    expect(result.current.form).toEqual({
      username: "alice",
      firstName: "Alice",
      lastName: "Doe",
      email: "alice@example.com",
    });
  });

  it("updates a field via handleChange", () => {
    const { result } = renderHook(() => useProfileForm());

    act(() => {
      result.current.handleChange("username")({
        target: { value: "alice2" },
      } as never);
    });

    expect(result.current.form.username).toBe("alice2");
  });

  it("does not call updateUser on submit when nothing changed", async () => {
    const { result } = renderHook(() => useProfileForm());

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("submits only the changed fields and shows a success message", async () => {
    updateUser.mockResolvedValue(undefined);
    refreshUser.mockResolvedValue(undefined);
    const { result } = renderHook(() => useProfileForm());

    act(() => {
      result.current.handleChange("firstName")({
        target: { value: "Alicia" },
      } as never);
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });

    expect(updateUser).toHaveBeenCalledWith({ firstName: "Alicia" });
    expect(refreshUser).toHaveBeenCalled();
    expect(result.current.message?.type).toBe("success");
  });

  it("shows the backend error message when the update fails", async () => {
    updateUser.mockRejectedValue({
      response: { data: { message: "Email already taken" } },
    });
    const { result } = renderHook(() => useProfileForm());

    act(() => {
      result.current.handleChange("email")({
        target: { value: "new@example.com" },
      } as never);
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });

    expect(result.current.message).toEqual({
      type: "error",
      text: "Email already taken",
    });
  });

  it("uploads a new avatar and shows a success message", async () => {
    vi.mocked(uploadProfilePicture).mockResolvedValue(undefined as never);
    refreshUser.mockResolvedValue(undefined);
    const { result } = renderHook(() => useProfileForm());

    const file = new File(["x"], "avatar.png", { type: "image/png" });
    await act(async () => {
      await result.current.handleAvatarChange({
        target: { files: [file] },
      } as never);
    });

    expect(uploadProfilePicture).toHaveBeenCalledWith("u1", file);
    expect(result.current.message?.type).toBe("success");
  });

  it("shows an error message when the avatar upload fails", async () => {
    vi.mocked(uploadProfilePicture).mockRejectedValue(new Error("too big"));
    const { result } = renderHook(() => useProfileForm());

    const file = new File(["x"], "a.png", { type: "image/png" });
    await act(async () => {
      await result.current.handleAvatarChange({
        target: { files: [file] },
      } as never);
    });

    expect(result.current.message?.type).toBe("error");
  });
});
