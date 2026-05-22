import React from "react";
import { useTranslation } from "react-i18next";
import { useSignupForm } from "@/hooks/useSignupForm";

interface SignupManualViewProps {
  onBack: () => void;
}

const BackChevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const MailIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
    <path d="m22 7-10 5L2 7"></path>
  </svg>
);

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]";

export const SignupManualView: React.FC<SignupManualViewProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const {
    fields,
    setField,
    loading,
    displayError,
    handleSubmit,
    registered,
    handleResend,
    resendMessage,
  } = useSignupForm();

  if (registered) {
    return (
      <div className="w-full flex flex-col items-center gap-3 text-center py-2">
        <span className="text-[#0071e3]">
          <MailIcon />
        </span>
        <h3 className="text-[#f5f5f7] text-lg font-semibold">
          {t("check_email_title")}
        </h3>
        <p className="text-[#86868b] text-sm">
          {t("check_email_desc", { email: fields.email })}
        </p>

        {resendMessage ? (
          <p className="text-green-400 text-xs bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 w-full">
            {resendMessage}
          </p>
        ) : (
          <button
            onClick={handleResend}
            className="text-[#0071e3] hover:text-[#0077ed] transition-colors text-sm font-medium cursor-pointer"
          >
            {t("resend_verification")}
          </button>
        )}

        <button
          onClick={onBack}
          className="mt-2 px-6 py-2 cursor-pointer rounded-full bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] hover:bg-[#3a3a3c] transition-colors"
        >
          {t("back")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <button
        onClick={onBack}
        className="text-[#0071e3] text-sm hover:underline self-start flex items-center gap-2"
      >
        <BackChevron />
        {t("back")}
      </button>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <input
          type="text"
          value={fields.firstName}
          onChange={(e) => setField("firstName")(e.target.value)}
          placeholder={t("first_name_placeholder")}
          className={inputClass}
        />
        <input
          type="text"
          value={fields.lastName}
          onChange={(e) => setField("lastName")(e.target.value)}
          placeholder={t("last_name_placeholder")}
          className={inputClass}
        />
      </div>

      <input
        type="text"
        value={fields.username}
        onChange={(e) => setField("username")(e.target.value)}
        placeholder={t("username_placeholder")}
        className={inputClass}
      />

      <input
        type="email"
        value={fields.email}
        onChange={(e) => setField("email")(e.target.value)}
        placeholder={t("email_placeholder")}
        className={inputClass}
      />

      <input
        type="password"
        value={fields.password}
        onChange={(e) => setField("password")(e.target.value)}
        placeholder={t("create_password_placeholder")}
        className={inputClass}
      />

      <input
        type="password"
        value={fields.confirmPassword}
        onChange={(e) => setField("confirmPassword")(e.target.value)}
        placeholder={t("confirm_password_placeholder")}
        className={inputClass}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />

      {displayError && (
        <p className="text-red-400 text-sm text-center w-full bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {displayError}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full px-4 py-3 cursor-pointer rounded-full bg-[#0071e3] text-white font-medium hover:bg-[#0077ed] transition-colors disabled:opacity-50 mt-2"
      >
        {loading ? t("loading") : t("continue")}
      </button>
    </div>
  );
};
