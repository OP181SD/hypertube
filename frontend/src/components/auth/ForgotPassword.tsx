import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { isValidEmail } from "@/constants/userFields";
import { type Action, goToLogin } from "./types";
import { AuthBackButton } from "./AuthBackButton";

type Props = {
  dispatch: (action: Action) => void;
};

export const AuthForgotPassword: React.FC<Props> = ({ dispatch }) => {
  const { t } = useTranslation();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleResetPassword = async () => {
    setError("");
    if (!email) {
      setError(t("enter_your_email"));
      return;
    }
    if (!isValidEmail(email)) {
      setError(t("error_invalid_email"));
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-5 pt-10 sm:p-12 sm:pt-16 bg-[#1c1c1e] w-full sm:w-150 h-full relative overflow-y-auto">
      <AuthBackButton
        onClick={() => dispatch(goToLogin())}
        label={t("back")}
        className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10"
      />
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 text-[#f5f5f7] font-bold text-lg sm:text-xl">
        Hyper<span className="colors-title-gradient">Tube</span>
      </div>

      <div className="flex grow flex-col items-center gap-3 sm:gap-4">
        <h2 className="text-[#f5f5f7] text-xl sm:text-2xl font-semibold text-center">
          {t("reset_your_password")}
        </h2>

        <p className="text-[#86868b] text-xs sm:text-sm text-center leading-relaxed max-w-105">
          {t("reset_description")}
        </p>

        {sent ? (
          <div className="w-full mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400 text-xs sm:text-sm text-center">
            {t("reset_link_sent", { email })}
          </div>
        ) : (
          <>
            <form
              className="w-full flex flex-col gap-2.5 sm:gap-3 mt-3 sm:mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleResetPassword();
              }}
            >
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("email_placeholder")}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-[#2c2c2e] text-sm sm:text-base text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]"
              />

            {error && (
              <p className="text-red-400 text-xs sm:text-sm text-center w-full bg-red-400/10 border border-red-400/20 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 sm:mt-2 px-4 py-2.5 sm:py-3 rounded-xl bg-[#0071e3] text-white text-sm sm:text-base font-medium hover:bg-[#0077ed] transition-colors disabled:opacity-50"
            >
              {loading ? t("loading") : t("send_reset_link")}
            </button>
            </form>
          </>
        )}

        <p className="text-[#8e8e93] text-[10px] sm:text-xs text-center mt-3 sm:mt-4 max-w-120">
          {t("reset_confirmation")}
        </p>
      </div>
    </div>
  );
};