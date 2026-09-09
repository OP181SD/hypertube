import { useState, type InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} pr-12`.trim()}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/80 transition-colors cursor-pointer"
        aria-label={visible ? t("hide_password") : t("show_password")}
        tabIndex={-1}
      >
        {visible ? (
          <EyeSlashIcon className="w-5 h-5" aria-hidden />
        ) : (
          <EyeIcon className="w-5 h-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
