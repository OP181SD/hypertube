import { FC, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDefaultAvatarUrl } from "@/constants/avatar";
import { resolveMediaUrl } from "@/constants/media";

export interface AvatarConfirmStepProps {
  /** Current picture URL (local path, absolute URL, or null → default). */
  previewUrl?: string | null;
  username?: string;
  loading?: boolean;
  error?: string | null;
  showBack?: boolean;
  onBack?: () => void;
  onConfirm: (file: File | null) => void | Promise<void>;
}

export const AvatarConfirmStep: FC<AvatarConfirmStepProps> = ({
  previewUrl,
  username,
  loading = false,
  error,
  showBack = false,
  onBack,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const base =
    localPreview ||
    resolveMediaUrl(previewUrl) ||
    getDefaultAvatarUrl();

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    if (!next) return;
    setFile(next);
    const objectUrl = URL.createObjectURL(next);
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <h3 className="text-[#f5f5f7] text-lg font-semibold text-center">
        {t("choose_profile_picture")}
      </h3>
      <p className="text-[#86868b] text-sm text-center max-w-sm">
        {t("choose_profile_picture_hint")}
      </p>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="relative rounded-full p-1 bg-gradient-to-tr from-[#795EF0] via-[#C270ED] to-[#38BDF8] cursor-pointer disabled:opacity-60"
      >
        <img
          src={base}
          alt={username ?? t("profile_picture")}
          className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover ring-2 ring-black/20"
        />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handlePick}
        className="hidden"
      />

      {error && (
        <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 w-full text-center">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl bg-[#2c2c2e] border border-[#424245] text-[#f5f5f7] text-sm font-medium hover:bg-[#3a3a3c] transition-colors disabled:opacity-60 cursor-pointer"
        >
          {t("change_photo")}
        </button>
        <button
          type="button"
          onClick={() => void onConfirm(file)}
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl bg-[#0071e3] text-white text-sm font-medium hover:bg-[#0077ed] transition-colors disabled:opacity-60 cursor-pointer"
        >
          {loading ? t("loading") : t("confirm_photo")}
        </button>
      </div>

      {showBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="text-[#86868b] text-sm hover:text-[#f5f5f7] transition-colors cursor-pointer"
        >
          {t("back")}
        </button>
      )}
    </div>
  );
};
