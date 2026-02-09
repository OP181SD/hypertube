import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { type Action, goToIdentify, goToForgotPassword } from "./types";

type Props = {
  dispatch: (action: Action) => void;
};

export const AuthLogin: React.FC<Props> = ({ dispatch }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, error: authError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
      // authError is set by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="flex flex-col gap-6 p-8 pt-12 bg-[#1c1c1e]">
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-[#f5f5f7] text-2xl font-semibold text-center">
          {t("welcome_back")}{" "}
          <span>Hyper</span>
          <span className="colors-title-gradient">Tube</span>
        </h2>

        <p className="text-[#86868b] text-sm text-center leading-relaxed max-w-105">
          {t("login_to_continue")}
        </p>

        <div className="w-full flex flex-col gap-3 mt-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("username_placeholder")}
            className="w-full p-4 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b] transition-colors"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password_placeholder")}
            className="w-full p-4 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b] transition-colors"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        {displayError && (
          <p className="text-red-400 text-sm text-center w-full bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
            {displayError}
          </p>
        )}

        <button
          onClick={() => dispatch(goToForgotPassword())}
          className="text-[#0071e3] hover:text-[#0077ed] transition-colors text-sm font-medium mt-2 cursor-pointer"
        >
          {t("forgot_password")}
        </button>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full mt-2 p-4 rounded-xl bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] transition-colors disabled:opacity-50"
        >
          {loading ? t("loading") : t("signin")}
        </button>

        <div className="w-full flex items-center gap-4 my-2">
          <div className="flex-1 h-px bg-[#424245]" />
          <span className="text-[#86868b] text-xs">{t("or")}</span>
          <div className="flex-1 h-px bg-[#424245]" />
        </div>

        <p className="text-[#86868b] text-xs text-center mt-1 max-w-full">
          {t("login_oauth_hint")}
        </p>

        <div className="grid grid-cols-2 gap-3 mt-2 w-full">
          <a
            href={`${apiUrl}/auth/google`}
            className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full"
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
            className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full"
          >
            <svg width="18" height="18" viewBox="0 0 137.6 96.4" fill="#fff">
              <polygon points="76.2,0 76.2,30.7 57.6,49.3 57.6,67.9 76.2,49.3 76.2,96.4 94.9,77.8 94.9,30.7" />
              <polygon points="0,47.5 0,67.9 38.9,67.9 38.9,96.4 57.6,96.4 57.6,49.3 19.5,49.3" />
              <polygon points="118.9,0 80,0 80,18.6 100.3,18.6 100.3,67.9 118.9,49.3 118.9,18.6 137.6,18.6 137.6,0" />
            </svg>
            42
          </a>
        </div>

        <button
          onClick={() => dispatch(goToIdentify())}
          className="text-[#0071e3] hover:text-[#0077ed] transition-colors text-sm font-medium mt-2 cursor-pointer"
        >
          {t("back")}
        </button>
      </div>
    </div>
  );
};
