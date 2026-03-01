import React from "react";
import { useTranslation } from "react-i18next";
import { OAuthProviders } from "./OAuthProviders";

interface SignupOAuthViewProps {
  onBack: () => void;
}

const BackChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

export const SignupOAuthView: React.FC<SignupOAuthViewProps> = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <div className="w-full">
      <button
        onClick={onBack}
        className="text-[#0071e3] text-sm hover:underline mb-4 flex items-center gap-2"
      >
        <BackChevron />
        {t("back") || "Retour"}
      </button>

      <OAuthProviders className="grid grid-cols-2 sm:grid-cols-3 gap-2" />

      <p className="text-[#86868b] text-xs text-center mt-3 max-w-full px-2 sm:px-0">
        {t("signup_oauth_hint")}
      </p>
    </div>
  );
};
