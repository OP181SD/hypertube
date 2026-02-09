import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!password || !confirmPassword) {
      setError(t("please_fill_all_fields"));
      return;
    }

    if (password.length < 8) {
      setError(t("error_password_too_short"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("error_passwords_not_match"));
      return;
    }

    if (!token) {
      setError(t("error_invalid_token"));
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch {
      setError(t("error_reset_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md bg-[#1c1c1e] rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-white text-center mb-2">
          {t("reset_your_password")}
        </h1>

        {success ? (
          <div className="text-center">
            <div className="mt-4 p-4 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400 text-sm">
              {t("password_reset_success")}
            </div>
            <button
              onClick={() => navigate("/")}
              className="mt-6 px-6 py-2.5 rounded-full bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] transition-colors"
            >
              {t("back_to_login")}
            </button>
          </div>
        ) : (
          <>
            <p className="text-[#86868b] text-sm text-center mb-6">
              {t("reset_new_password_description")}
            </p>

            <div className="flex flex-col gap-3">
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
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {error && (
              <p className="mt-3 text-red-400 text-sm text-center bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full mt-4 px-4 py-3 rounded-xl bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] transition-colors disabled:opacity-50"
            >
              {loading ? t("loading") : t("reset_password_button")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
