import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { type Action, goToLogin } from "./types";

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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t("error_invalid_email"));
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      // still show success (backend always returns success for security)
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-12 pt-16 bg-[#1c1c1e] w-150 h-full relative overflow-y-auto">
      <div className="absolute top-4 right-4 text-[#f5f5f7] font-bold text-xl">
        Hyper <span className="colors-title-gradient">Tube</span>
      </div>

      <div className="flex grow flex-col items-center gap-4">
        <h2 className="text-[#f5f5f7] text-2xl font-semibold text-center">
          {t("reset_your_password")}
        </h2>

        <p className="text-[#86868b] text-sm text-center leading-relaxed max-w-105">
          {t("reset_description")}
        </p>

        {sent ? (
          <div className="w-full mt-4 p-4 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400 text-sm text-center">
            {t("reset_link_sent", { email })}
          </div>
        ) : (
          <>
            <div className="w-full flex flex-col gap-3 mt-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("email_placeholder")}
                className="w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]"
                onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center w-full bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full mt-4 px-4 py-3 rounded-xl bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] transition-colors disabled:opacity-50"
            >
              {loading ? t("loading") : t("send_reset_link")}
            </button>
          </>
        )}

        <button
          onClick={() => dispatch(goToLogin())}
          className="text-[#0071e3] hover:text-[#0077ed] transition-colors text-sm font-medium mt-2 cursor-pointer"
        >
          {t("back_to_login")}
        </button>

        <p className="text-[#8e8e93] text-xs text-center mt-4 max-w-120">
          {t("reset_confirmation")}
        </p>
      </div>
    </div>
  );
};
