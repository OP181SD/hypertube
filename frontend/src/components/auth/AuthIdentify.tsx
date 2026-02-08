import React from "react";
import { useTranslation } from "react-i18next";
import { AuthPage } from "./types";

type Props = {
    state: AuthPage,
    email: string,
    setEmail: (email: string) => void;
    handleContinue: () => void;
}

export const AuthIdentify: React.FC<Props> = ({ email, setEmail, handleContinue }) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-8 w-200 h-140 pt-12.5 pb-7.5 px-[10] bg-[#1c1c1e]">

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

            <div className="flex flex-col items-center gap-4 mt-6">
                <h2 className="text-[#f5f5f7] text-xl font-medium text-center">
                    {t("continue_with_email")}
                </h2>

                <p className="text-[#86868b] text-sm text-center leading-relaxed max-w-105">
                    {t("identify_description")}
                </p>

                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("email_placeholder")}
                    className="
    mt-4 w-[90] p-4 rounded-xl
    bg-[#2c2c2e] text-[#f5f5f7]
    border border-[#424245]

    focus:border-[#0071e3]
    focus:outline-none

    placeholder-[#86868b]
    transition-colors
  "
                />
                <button
                    onClick={handleContinue}
                    className=" cursor-pointer
    mt-4 px-10 py-3 rounded-xl
    bg-[#2c2c2e] text-[#f5f5f7] font-medium
    border border-[#424245]

    hover:bg-[#3a3a3c]
    active:scale-[0.98]

    transition-all duration-200 ease-out
  "
                >
                    {t("continue")}
                </button>


                <p className="text-[#86868b] text-xs text-center mt-2 max-w-105">
                    {t("terms_full_notice")}
                </p>
            </div>
        </div>
    );
};
