import React, { useRef, useState } from "react";
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

const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-[#2c2c2e] text-[#f5f5f7] border border-[#424245] focus:border-[#0071e3] focus:outline-none placeholder-[#86868b]";

export const SignupManualView: React.FC<SignupManualViewProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { fields, setField, setProfilePicture, loading, displayError, handleSubmit } = useSignupForm();
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setProfilePicture(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } else {
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <button
        onClick={onBack}
        className="text-[#0071e3] text-sm hover:underline self-start flex items-center gap-2"
      >
        <BackChevron />
        {t("back") || "Retour"}
      </button>

      {/* Avatar picker */}
      <div className="flex flex-col items-center gap-2 py-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative w-20 h-20 rounded-full bg-[#2c2c2e] border-2 border-[#424245] hover:border-[#0071e3] transition-colors overflow-hidden flex items-center justify-center cursor-pointer"
          aria-label={t("profile_picture_required")}
        >
          {preview ? (
            <img src={preview} alt="avatar preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[#86868b]"><CameraIcon /></span>
          )}
        </button>
        <span className="text-[#86868b] text-xs">{t("profile_picture_required")}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

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
