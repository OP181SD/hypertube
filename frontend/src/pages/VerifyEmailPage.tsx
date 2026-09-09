import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { isValidEmail } from "@/constants/userFields";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();

  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!token) return;

    verifyEmail(token)
      .then(() => {
        setStatus("success");
        setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
      })
      .catch(() => setStatus("error"));
  }, [token, verifyEmail, navigate]);

  const handleResend = async () => {
    setResendMessage("");
    setResendError("");
    if (!isValidEmail(resendEmail)) {
      setResendError(t("error_invalid_email"));
      return;
    }
    try {
      await resendVerification(resendEmail);
    } catch {

    }
    setResendMessage(t("resend_verification_done"));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-3 sm:px-4">
      <div className="w-full max-w-md bg-[#1c1c1e] rounded-2xl p-5 sm:p-8 text-center">
        <h1 className="text-xl sm:text-2xl font-semibold text-white mb-4">
          {t("verify_email_title")}
        </h1>

        {status === "verifying" && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
            <p className="text-[#86868b] text-sm">{t("verify_email_verifying")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="p-3 sm:p-4 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400 text-xs sm:text-sm">
            {t("verify_email_success")}
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-3">
            <p className="p-3 sm:p-4 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-xs sm:text-sm">
              {t("verify_email_failed")}
            </p>

            {resendMessage ? (
              <p className="p-3 rounded-xl bg-green-400/10 border border-green-400/20 text-green-400 text-xs sm:text-sm">
                {resendMessage}
              </p>
            ) : (
              <>
                <p className="text-[#86868b] text-xs sm:text-sm">
                  {t("verify_email_resend_prompt")}
                </p>
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleResend();
                  }}
                >
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder={t("email_placeholder")}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-[#2c2c2e] text-sm sm:text-base text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]"
                />
                {resendError && (
                  <p className="text-red-400 text-xs sm:text-sm">{resendError}</p>
                )}
                <button
                  type="submit"
                  className="w-full px-4 py-2.5 sm:py-3 rounded-xl bg-[#0071e3] text-white text-sm sm:text-base font-medium hover:bg-[#0077ed] transition-colors"
                >
                  {t("resend_verification")}
                </button>
                </form>
              </>
            )}

            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-[#0071e3] hover:text-[#0077ed] transition-colors text-sm font-medium mt-1 cursor-pointer"
            >
              {t("back_to_login")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
