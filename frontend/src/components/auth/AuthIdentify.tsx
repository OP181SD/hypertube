import React from "react";
import { useTranslation } from "react-i18next";
import { type Action, goToLogin, goToSignup } from "./types";
import { OAuthProviders } from "./OAuthProviders";

type Props = {
  dispatch: (action: Action) => void;
};

export const AuthIdentify: React.FC<Props> = ({ dispatch }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-8 p-12 pt-12.5 pb-7.5 bg-[#1c1c1e]">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center">
          <span className="text-[28px] font-semibold tracking-tight text-white/90">
            Hyper
          </span>
          <span className="ml-1 text-[28px] font-semibold tracking-tight colors-title-gradient">
            Tube
          </span>
        </div>
        <span className="text-[#86868b] text-xs uppercase tracking-widest">
          {t("stream_without_limits")}
        </span>
      </div>

      <div className="flex flex-col items-center gap-4 mt-2">
        <p className="text-[#86868b] text-sm text-center leading-relaxed max-w-105">
          {t("identify_description")}
        </p>

        <button
          onClick={() => dispatch(goToLogin())}
          className="cursor-pointer mt-4 w-90 p-4 rounded-xl bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] transition-colors"
        >
          {t("signin")}
        </button>

        <button
          onClick={() => dispatch(goToSignup())}
          className="cursor-pointer w-90 p-4 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] font-medium border border-[#424245] hover:bg-[#3a3a3c] transition-colors"
        >
          {t("create_account")}
        </button>

        <div className="w-full flex items-center gap-4 my-2">
          <div className="flex-1 h-px bg-[#424245]" />
          <span className="text-[#86868b] text-xs">{t("or")}</span>
          <div className="flex-1 h-px bg-[#424245]" />
        </div>

        <OAuthProviders className="grid grid-cols-3 gap-2 w-full max-w-90" />

        <p className="text-[#86868b] text-xs text-center mt-2 max-w-105">
          {t("terms_full_notice")}
        </p>
      </div>
    </div>
  );
};
