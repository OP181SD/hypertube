import React from "react";
import { useTranslation } from "react-i18next";

interface SignupChoiceViewProps {
  onSelectOAuth: () => void;
  onSelectManual: () => void;
}

export const SignupChoiceView: React.FC<SignupChoiceViewProps> = ({
  onSelectOAuth,
  onSelectManual,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-full flex flex-col gap-4 mt-4">
      <button
        onClick={onSelectOAuth}
        className="w-full px-6 py-5 rounded-xl bg-[#2c2c2e] border-2 border-[#424245] text-[#f5f5f7] hover:border-[#0071e3] hover:bg-[#3a3a3c] transition-all flex items-center justify-center gap-3"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4M12 8h.01"></path>
        </svg>
        <span className="font-medium text-base">{t("signin_with_social") || "Se connecter avec OAuth"}</span>
      </button>

      <button
        onClick={onSelectManual}
        className="w-full px-6 py-5 rounded-xl bg-[#2c2c2e] border-2 border-[#424245] text-[#f5f5f7] hover:border-[#0071e3] hover:bg-[#3a3a3c] transition-all flex items-center justify-center gap-3"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span className="font-medium text-base">{t("signin_manually") || "S'inscrire manuellement"}</span>
      </button>
    </div>
  );
};
