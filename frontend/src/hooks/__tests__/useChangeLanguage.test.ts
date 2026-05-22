import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { I18N_TO_LANG } from "@/constants/language";
import { useChangeLanguage } from "../useChangeLanguage";

const changeLanguage = vi.fn();
const updateUser = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { changeLanguage, language: "en-US" },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ updateUser }),
}));

describe("useChangeLanguage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes the current language without the region suffix", () => {
    const { result } = renderHook(() => useChangeLanguage());
    expect(result.current.currentLang).toBe("en");
  });

  it("switches the i18n language and syncs it to the backend", async () => {
    updateUser.mockResolvedValue(undefined);
    const { result } = renderHook(() => useChangeLanguage());

    await act(async () => {
      await result.current.changeLanguage("fr");
    });

    expect(changeLanguage).toHaveBeenCalledWith("fr");
    expect(updateUser).toHaveBeenCalledWith({ language: I18N_TO_LANG.fr });
  });

  it("ignores a backend sync failure — language change is non-critical", async () => {
    updateUser.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useChangeLanguage());

    await expect(
      act(async () => {
        await result.current.changeLanguage("es");
      }),
    ).resolves.not.toThrow();
  });

  it("does not sync an unknown language code to the backend", async () => {
    const { result } = renderHook(() => useChangeLanguage());

    await act(async () => {
      await result.current.changeLanguage("xx");
    });

    expect(changeLanguage).toHaveBeenCalledWith("xx");
    expect(updateUser).not.toHaveBeenCalled();
  });
});
