import React from "react";
import { useChangeLanguage } from "@/hooks/useChangeLanguage";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "🇬🇧 English" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "ru", label: "🇷🇺 Русский" },
  { value: "ja", label: "🇯🇵 日本語" },
  { value: "ko", label: "🇰🇷 한국어" },
  { value: "zh", label: "🇨🇳 中文" },
  { value: "ar", label: "🇸🇦 العربية" },
  { value: "nl", label: "🇳🇱 Nederlands" },
  { value: "pl", label: "🇵🇱 Polski" },
  { value: "sv", label: "🇸🇪 Svenska" },
  { value: "tr", label: "🇹🇷 Türkçe" },
] as const;

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className }) => {
  const { changeLanguage, currentLang } = useChangeLanguage();

  return (
    <select
      value={currentLang}
      onChange={(e) => changeLanguage(e.target.value)}
      className={className}
    >
      {LANGUAGE_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
};
