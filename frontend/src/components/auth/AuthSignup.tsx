import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Action, goToIdentify } from "./types";
import { SignupChoiceView } from "./SignupChoiceView";
import { SignupOAuthView } from "./SignupOAuthView";
import { SignupManualView } from "./SignupManualView";

type AuthMode = "choice" | "oauth" | "manual";

type Props = {
  dispatch: (action: Action) => void;
};

export const AuthSignup: React.FC<Props> = ({ dispatch }) => {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<AuthMode>("choice");

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-8 md:p-12 pt-8 sm:pt-12 md:pt-16 bg-[#1c1c1e] w-full sm:w-150 h-full relative overflow-y-auto">
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 text-[#f5f5f7] font-bold text-lg sm:text-xl">
        Hyper <span className="colors-title-gradient">Tube</span>
      </div>

      <div className="flex grow flex-col items-center gap-3 sm:gap-4">
        <h2 className="text-[#f5f5f7] text-xl sm:text-2xl font-semibold text-center mt-8 sm:mt-0">
          {t("create_account")}
        </h2>

        <p className="text-[#86868b] text-xs sm:text-sm text-center leading-relaxed max-w-full sm:max-w-105 px-2 sm:px-0">
          {t("signup_description")}
        </p>

        {authMode === "choice" && (
          <SignupChoiceView
            onSelectOAuth={() => setAuthMode("oauth")}
            onSelectManual={() => setAuthMode("manual")}
          />
        )}

        {authMode === "oauth" && (
          <SignupOAuthView onBack={() => setAuthMode("choice")} />
        )}

        {authMode === "manual" && (
          <SignupManualView onBack={() => setAuthMode("choice")} />
        )}

        <div className="flex justify-center gap-4 mt-auto pt-4 border-t border-[#424245] w-full">
          <button
            onClick={() => dispatch(goToIdentify())}
            className="px-6 py-2 cursor-pointer rounded-full bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors"
          >
            {t("back")}
          </button>
        </div>

        <p className="text-[#8e8e93] text-xs text-center mt-2 max-w-full sm:max-w-120 px-2 sm:px-0">
          {t("terms_privacy_notice")}
        </p>
      </div>
    </div>
  );
};
