import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { type Action, goToIdentify, goToForgotPassword } from "./types";
import { AuthBackButton } from "./AuthBackButton";
import { PasswordInput } from "@/components/ui/PasswordInput";

type Props = {
  dispatch: (action: Action) => void;
};

export const AuthLogin: React.FC<Props> = ({ dispatch }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, error: authError, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleLogin = async () => {
    setLocalError("");
    if (!username || !password) {
      setLocalError(t("please_fill_all_fields"));
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch {

    } finally {
      setLoading(false);
    }
  };

  const translatedAuthError =
    authError === "Invalid credentials"
      ? t("error_invalid_credentials")
      : authError === "Please verify your email before logging in"
        ? t("error_email_not_verified")
        : authError;
  const displayError = localError || translatedAuthError;

  return (
    <div className="relative flex flex-col gap-6 p-8 pt-14 bg-[#1c1c1e]">
      <AuthBackButton
        onClick={() => dispatch(goToIdentify())}
        label={t("back")}
        className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10"
      />
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 text-[#f5f5f7] font-bold text-lg sm:text-xl">
        Hyper<span className="colors-title-gradient">Tube</span>
      </div>

      <div className="flex flex-col items-center gap-4">
        <h2 className="text-[#f5f5f7] text-2xl font-semibold text-center">
          {t("welcome_back")}
        </h2>

        <p className="text-[#86868b] text-sm text-center leading-relaxed max-w-105">
          {t("login_to_continue")}
        </p>

        <form
          className="w-full flex flex-col gap-3 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin();
          }}
        >
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("username_placeholder")}
            className="w-full p-4 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b] transition-colors"
          />

          <PasswordInput
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password_placeholder")}
            autoComplete="current-password"
            className="w-full p-4 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b] transition-colors"
          />

        {displayError && (
          <p className="text-red-400 text-sm text-center w-full bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
            {displayError}
          </p>
        )}

        <button
          type="button"
          onClick={() => dispatch(goToForgotPassword())}
          className="text-[#0071e3] hover:text-[#0077ed] transition-colors text-sm font-medium mt-2 cursor-pointer"
        >
          {t("forgot_password")}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 p-4 rounded-xl bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] transition-colors disabled:opacity-50"
        >
          {loading ? t("loading") : t("signin")}
        </button>
        </form>
      </div>
    </div>
  );
};
