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

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]";

export const SignupManualView: React.FC<SignupManualViewProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { fields, setField, loading, displayError, handleSubmit } = useSignupForm();

  return (
    <div className="w-full flex flex-col gap-3">
      <button
        onClick={onBack}
        className="text-[#0071e3] text-sm hover:underline self-start flex items-center gap-2"
      >
        <BackChevron />
        {t("back") || "Retour"}
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
