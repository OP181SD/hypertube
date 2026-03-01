import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { I18N_TO_LANG } from "@/constants/language";

export function useChangeLanguage() {
  const { i18n } = useTranslation();
  const { updateUser } = useAuth();

  const changeLanguage = useCallback(
    async (lng: string) => {
      await i18n.changeLanguage(lng);
      const backendLang = I18N_TO_LANG[lng];
      if (backendLang) {
        try {
          await updateUser({ language: backendLang as "EN" | "FR" | "ES" | "IT" | "PT" | "DE" | "RU" | "JA" | "KO" | "ZH" | "AR" | "NL" | "PL" | "SV" | "TR" });
        } catch {
          // Language sync failure is non-critical
        }
      }
    },
    [i18n, updateUser],
  );

  return { changeLanguage, currentLang: i18n.language.split("-")[0] };
}
