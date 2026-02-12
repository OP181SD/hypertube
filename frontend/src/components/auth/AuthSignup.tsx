import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { type Action, goToIdentify } from "./types";

type Props = {
  dispatch: (action: Action) => void;
};

export const AuthSignup: React.FC<Props> = ({ dispatch }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, error: authError } = useAuth();

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"choice" | "oauth" | "manual">("choice");

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const handleSignup = async () => {
    setLocalError("");

    if (
      !username ||
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      setLocalError(t("please_fill_all_fields"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError(t("error_invalid_email"));
      return;
    }

    if (username.length < 3 || username.length > 30) {
      setLocalError(t("error_username_length"));
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setLocalError(t("error_username_format"));
      return;
    }

    if (password.length < 8) {
      setLocalError(t("error_password_too_short"));
      return;
    }

    if (password !== confirmPassword) {
      setLocalError(t("error_passwords_not_match"));
      return;
    }

    setLoading(true);
    try {
      await register({ email, username, firstName, lastName, password });
      navigate("/dashboard");
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError || authError;

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
          <div className="w-full flex flex-col gap-4 mt-4">
            <button
              onClick={() => setAuthMode("oauth")}
              className="w-full px-6 py-5 rounded-xl bg-[#2c2c2e] border-2 border-[#424245] text-[#f5f5f7] hover:border-[#0071e3] hover:bg-[#3a3a3c] transition-all flex items-center justify-center gap-3"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4M12 8h.01"></path>
              </svg>
              <span className="font-medium text-base">{t("signin_with_social") || "Se connecter avec OAuth"}</span>
            </button>

            <button
              onClick={() => setAuthMode("manual")}
              className="w-full px-6 py-5 rounded-xl bg-[#2c2c2e] border-2 border-[#424245] text-[#f5f5f7] hover:border-[#0071e3] hover:bg-[#3a3a3c] transition-all flex items-center justify-center gap-3"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span className="font-medium text-base">{t("signin_manually") || "S'inscrire manuellement"}</span>
            </button>
          </div>
        )}

        {authMode === "oauth" && (
          <div className="w-full">
            <button
              onClick={() => setAuthMode("choice")}
              className="text-[#0071e3] text-sm hover:underline mb-4 flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              {t("back") || "Retour"}
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <a
                href={`${apiUrl}/auth/google`}
                className="flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full text-xs"
              >
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#795EF0" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.1 29.2 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.4 6.5 28.9 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.9-4.5z" />
                  <path fill="#C270ED" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.4 6.5 28.9 4.5 24 4.5c-7.6 0-14.1 4.3-17.7 10.2z" />
                  <path fill="#38BDF8" d="M24 45.5c4.8 0 9.2-1.9 12.5-5l-5.8-4.9c-1.7 1.3-3.9 2.1-6.7 2.1-5.1 0-9.4-3.4-10.9-8.1l-6.7 5.2C9.9 41.1 16.5 45.5 24 45.5z" />
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.3 5.3-6.3 6.6l5.8 4.9C38.3 36.3 44.5 32 44.5 25c0-1.5-.2-3-.9-4.5z" />
                </svg>
                Google
              </a>

              <a
                href={`${apiUrl}/auth/42`}
                className="flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full text-xs"
              >
                <svg width="16" height="16" viewBox="0 0 137.6 96.4" fill="#fff">
                  <polygon points="76.2,0 76.2,30.7 57.6,49.3 57.6,67.9 76.2,49.3 76.2,96.4 94.9,77.8 94.9,30.7" />
                  <polygon points="0,47.5 0,67.9 38.9,67.9 38.9,96.4 57.6,96.4 57.6,49.3 19.5,49.3" />
                  <polygon points="118.9,0 80,0 80,18.6 100.3,18.6 100.3,67.9 118.9,49.3 118.9,18.6 137.6,18.6 137.6,0" />
                </svg>
                42
              </a>

              <a
                href={`${apiUrl}/auth/github`}
                className="flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full text-xs"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </a>

              <a
                href={`${apiUrl}/auth/facebook`}
                className="flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full text-xs"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Facebook
              </a>

              <a
                href={`${apiUrl}/auth/twitter`}
                className="flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full text-xs"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X
              </a>

              <a
                href={`${apiUrl}/auth/discord`}
                className="flex items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full text-xs"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Discord
              </a>
            </div>

            <p className="text-[#86868b] text-xs text-center mt-3 max-w-full px-2 sm:px-0">
              {t("signup_oauth_hint")}
            </p>
          </div>
        )}

        {authMode === "manual" && (
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => setAuthMode("choice")}
              className="text-[#0071e3] text-sm hover:underline self-start flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              {t("back") || "Retour"}
            </button>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t("first_name_placeholder")}
                className="w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]"
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t("last_name_placeholder")}
                className="w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]"
              />
            </div>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("username_placeholder")}
              className="w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]"
            />

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email_placeholder")}
              className="w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("create_password_placeholder")}
              className="w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]"
            />

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("confirm_password_placeholder")}
              className="w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]"
            />

            {displayError && (
              <p className="text-red-400 text-sm text-center w-full bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                {displayError}
              </p>
            )}

            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full px-4 py-3 cursor-pointer rounded-full bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? t("loading") : t("continue")}
            </button>
          </div>
        )}

        {authMode !== "choice" && (
          <div className="flex justify-center gap-4 mt-auto pt-4 border-t border-[#424245] w-full">
            <button
              onClick={() => dispatch(goToIdentify())}
              className="px-6 py-2 cursor-pointer rounded-full bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors"
            >
              {t("back")}
            </button>
          </div>
        )}

        {authMode === "choice" && (
          <div className="flex justify-center gap-4 mt-auto pt-4 border-t border-[#424245] w-full">
            <button
              onClick={() => dispatch(goToIdentify())}
              className="px-6 py-2 cursor-pointer rounded-full bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors"
            >
              {t("back")}
            </button>
          </div>
        )}

        <p className="text-[#8e8e93] text-xs text-center mt-2 max-w-full sm:max-w-120 px-2 sm:px-0">
          {t("terms_privacy_notice")}
        </p>
      </div>
    </div>
  );
};