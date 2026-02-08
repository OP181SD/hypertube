import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  const contributors = [
    { name: "Yassine", link: "https://github.com/USERNAME_YASSINE" },
    { name: "Jérémy", link: "https://github.com/USERNAME_JEREMY" },
    { name: "Farouk", link: "https://github.com/USERNAME_FAROUK" },
    { name: "Nessrine", link: "https://github.com/USERNAME_NESSRINE" },
  ];

  return (
    <footer className="px-4 py-6 sm:py-8 md:py-10 text-white font-inter">
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 sm:gap-x-3 sm:gap-y-2 md:gap-x-4 text-center text-[11px] sm:text-xs md:text-sm text-white/70">
        <a
          href="https://github.com/OP181SD/hypertube"
          target="_blank"
          className="hover:text-white/90 transition-colors duration-200"
        >
          {t("project_github")}
        </a>

        <span className="cursor-default">{t("contributors")} :</span>

        {contributors.map((contributor, index) => (
          <a
            key={index}
            href={contributor.link}
            target="_blank"
            className="hover:text-[#38BDF8] transition-colors duration-200"
          >
            {contributor.name}
          </a>
        ))}
      </div>

      <div className="flex justify-center my-4 sm:my-6">
        <div className="w-full max-w-[320px] sm:max-w-105 md:max-w-125 h-px bg-white/10" />
      </div>

      <div className="text-center text-[10px] sm:text-[11px] md:text-xs text-white/30">
        {t("designed_by")}
        <span className="font-bold text-[#795EF0] px-1">ي</span>
        · {t("all_rights_reserved")} © 2026
      </div>
    </footer>
  );
}
