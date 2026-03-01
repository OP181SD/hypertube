import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="px-4 py-6 sm:py-8 md:py-10 text-white font-inter">
      <div className="flex justify-center my-4 sm:my-6">
        <div className="w-full max-w-[320px] sm:max-w-105 md:max-w-125 h-px bg-white/10" />
      </div>

      <div className="text-center text-[10px] sm:text-[11px] md:text-xs text-white/30">
        {t("all_rights_reserved")} © 2026
      </div>
    </footer>
  );
}
