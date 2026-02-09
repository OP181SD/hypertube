import React from "react";
import { useTranslation } from "react-i18next";
import { type Action, goToLogin, goToSignup } from "./types";

type Props = {
  dispatch: (action: Action) => void;
};

export const AuthIdentify: React.FC<Props> = ({ dispatch }) => {
  const { t } = useTranslation();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

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

        <div className="grid grid-cols-2 gap-3 w-full max-w-90">
          <a
            href={`${apiUrl}/auth/google`}
            className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#795EF0" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.1 29.2 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.4 6.5 28.9 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.9-4.5z" />
              <path fill="#C270ED" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.4 6.5 28.9 4.5 24 4.5c-7.6 0-14.1 4.3-17.7 10.2z" />
              <path fill="#38BDF8" d="M24 45.5c4.8 0 9.2-1.9 12.5-5l-5.8-4.9c-1.7 1.3-3.9 2.1-6.7 2.1-5.1 0-9.4-3.4-10.9-8.1l-6.7 5.2C9.9 41.1 16.5 45.5 24 45.5z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.3 5.3-6.3 6.6l5.8 4.9C38.3 36.3 44.5 32 44.5 25c0-1.5-.2-3-.9-4.5z" />
            </svg>
            Google
          </a>

          <a
            href={`${apiUrl}/auth/42`}
            className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 137.6 96.4" fill="#fff">
              <polygon points="76.2,0 76.2,30.7 57.6,49.3 57.6,67.9 76.2,49.3 76.2,96.4 94.9,77.8 94.9,30.7" />
              <polygon points="0,47.5 0,67.9 38.9,67.9 38.9,96.4 57.6,96.4 57.6,49.3 19.5,49.3" />
              <polygon points="118.9,0 80,0 80,18.6 100.3,18.6 100.3,67.9 118.9,49.3 118.9,18.6 137.6,18.6 137.6,0" />
            </svg>
            42
          </a>
        </div>

        <p className="text-[#86868b] text-xs text-center mt-2 max-w-105">
          {t("terms_full_notice")}
        </p>
      </div>
    </div>
  );
};
