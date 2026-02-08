import React from "react";
import { useTranslation } from "react-i18next";
import { Action, goToIdentify, goToForgotPassword } from "./types";


type Props = {
    email: string;
    setEmail: (email: string) => void;
    password: string;
    setPassword: (password: string) => void;
    handleLogin: () => void;
    dispatch: (action: Action) => void;
    error?: string;
};

export const AuthLogin: React.FC<Props> = ({
    email,
    setEmail,
    password,
    setPassword,
    handleLogin,
    dispatch,
    error,
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-6 p-8 pt-12 bg-[#1c1c1e]">
            <div className="flex flex-col items-center gap-4">

                <h2 className="text-[#f5f5f7] text-2xl font-semibold text-center">
                    {t("welcome_back")}   <span>Hyper</span><span className="colors-title-gradient">Tube</span>
                </h2>

                <p className="text-[#86868b] text-sm text-center leading-relaxed max-w-105">
                    {t("login_to_continue")}
                </p>

                <div className="w-full flex flex-col gap-3 mt-2">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("email_placeholder")}
                        className="w-full p-4 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b] transition-colors"
                    />

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("password_placeholder")}
                        className="w-full p-4 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b] transition-colors"
                    />
                </div>

                {error && (
                    <p className="text-red-400 text-sm text-center w-full bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                        {error}
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
                    className="w-full mt-2 p-4 rounded-xl bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] transition-colors"
                >
                    {t("signin")}
                </button>

                <div className="w-full flex items-center gap-4 my-2">
                    <div className="flex-1 h-px bg-[#424245]" />
                    <span className="text-[#86868b] text-xs">{t("or")}</span>
                    <div className="flex-1 h-px bg-[#424245]" />
                </div>

                <p className="text-[#86868b] text-xs text-center mt-1 max-w-full">
                    {t("login_oauth_hint")}
                </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 w-full">
  {/* Google */}
  <button className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full">
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#795EF0" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.1 29.2 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.4 6.5 28.9 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.9-4.5z" />
      <path fill="#C270ED" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.4 6.5 28.9 4.5 24 4.5c-7.6 0-14.1 4.3-17.7 10.2z" />
      <path fill="#38BDF8" d="M24 45.5c4.8 0 9.2-1.9 12.5-5l-5.8-4.9c-1.7 1.3-3.9 2.1-6.7 2.1-5.1 0-9.4-3.4-10.9-8.1l-6.7 5.2C9.9 41.1 16.5 45.5 24 45.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3-3.3 5.3-6.3 6.6l5.8 4.9C38.3 36.3 44.5 32 44.5 25c0-1.5-.2-3-.9-4.5z" />
    </svg>
    Google
  </button>

  {/* Apple */}
  <button className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full">
    <svg width="18" height="18" viewBox="0 0 512 512" fill="#fff">
      <path d="M349.1 117.9c-11.2-13.4-24.1-26.8-41-26.8-16.8 0-22.5 9.1-41.9 9.1-19.1 0-29.1-8.8-48-8.8-24.7 0-47.5 14.2-60.2 36.2-26 44.6-6.6 110.2 18.8 146.3 12.3 17.3 27 36.8 46.3 36 18.7-.8 25.7-12.1 48-12.1 22.4 0 28.7 12.1 48.4 11.6 20.3-.5 33.1-17.6 45.4-34.8 14.2-19.3 19.9-38 20.3-39 0-.2-.2-.3-.4-.5-1.2-.6-50.7-19.7-51.5-78.9-.5-34.2 27.3-50.2 28-50.6-15.3-22.5-38.9-25.5-46.7-25.9zM328 56.1c8.4-10.2 14.1-24.5 12.5-38.1-12.1.5-26.8 8.1-35.5 18.4-7.7 9.1-14.5 23.8-12.7 37.7 13.4 1.1 27-6.9 35.7-18z"/>
    </svg>
    Apple
  </button>

  {/* X / Twitter */}
  <button className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full">
    <svg width="18" height="18" viewBox="0 0 512 512" fill="#1DA1F2">
      <path d="M459.4 151.7c.3 4.1 .3 8.3 .3 12.4 0 126.4-96.2 272.3-272.3 272.3-54 0-104.3-15.8-146.5-42.9 7.5.9 15 1.1 22.8 1.1 44.9 0 86-15.3 118.7-41.1-42.1-.9-77.6-28.6-89.8-66.8 5.9.9 11.9 1.6 18.1 1.6 8.7 0 17.1-1.2 25.1-3.4-44-8.9-77-47.6-77-94.1v-1.2c12.9 7.2 27.7 11.6 43.5 12.1-25.8-17.2-42.8-46.5-42.8-79.7 0-17.6 4.7-34 13-48.1 48.1 59 120.1 97.7 201.1 101.9-1.7-7.2-2.6-14.8-2.6-22.5 0-54.5 44.2-98.8 98.8-98.8 28.4 0 54.1 12 72.1 30.9 22.5-4.4 43.6-12.7 62.6-24.1-7.4 23-23 42.3-43.2 54.5 20-2.3 39.2-7.7 57-15.6-13.2 19.7-29.9 37-49.1 50.8z"/>
    </svg>
    X
  </button>

  {/* Facebook */}
  <button className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors w-full">
    <svg width="18" height="18" viewBox="0 0 512 512" fill="#1877F2">
      <path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.7 90.7 226.3 209 245v-173h-63v-72h63v-55.1c0-62.1 37-96.9 93.7-96.9 27.1 0 55.5 4.8 55.5 4.8v61h-31.3c-30.8 0-40.3 19.1-40.3 38.8V256h68.7l-11 72H293v173c118.3-18.7 209-121.3 209-245z"/>
    </svg>
    Facebook
  </button>
</div>


                <button
                    onClick={() => dispatch(goToIdentify())}
                    className="text-[#0071e3] hover:text-[#0077ed] transition-colors text-sm font-medium mt-2 cursor-pointer"
                >
                    {t("back_to_email")}
                </button>
            </div>
        </div>
    );
};
