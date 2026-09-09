import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="px-4 pb-4 pt-2 sm:pb-5 sm:pt-3 text-white font-inter">
      <div className="text-center text-[10px] sm:text-[11px] md:text-xs text-white/30">
        {t("all_rights_reserved")} © 2026
      </div>
    </footer>
  );
}
