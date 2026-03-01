import { useState } from "react";
import { Modal } from "@/components/modal/Modal";
import { useTranslation } from "react-i18next";

export default function Navbar() {
  const [isModalOpen, setIsOpenModal] = useState(false);
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => i18n.changeLanguage(lng);

  return (
    <header>
      <nav className="h-12 md:h-13 xl:h-15 px-4 md:px-6 xl:px-8 backdrop-blur-md bg-black/80">
        <div className="flex items-center h-full max-w-400 mx-auto w-full">

          <div className="flex flex-1 items-center xl:justify-center mt-px">
            <div className="flex items-center">
              <span className="text-[16px] font-medium text-white/90">
                Hyper
              </span>
              <span className="ml-1 text-[16px] font-medium colors-title-gradient">
                Tube
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="bg-black/50 text-white/90 px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-all duration-200 text-xs sm:text-sm"
            >
              <option value="en">🇬🇧 English</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="es">🇪🇸 Español</option>
              <option value="it">🇮🇹 Italiano</option>
              <option value="pt">🇵🇹 Português</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="ru">🇷🇺 Русский</option>
              <option value="ja">🇯🇵 日本語</option>
              <option value="ko">🇰🇷 한국어</option>
              <option value="zh">🇨🇳 中文</option>
              <option value="ar">🇸🇦 العربية</option>
              <option value="nl">🇳🇱 Nederlands</option>
              <option value="pl">🇵🇱 Polski</option>
              <option value="sv">🇸🇪 Svenska</option>
              <option value="tr">🇹🇷 Türkçe</option>
            </select>

            <button className="px-4 md:px-5 xl:px-6 py-1 rounded-md border border-white/30 hover:bg-white/10 transition">
              <span
                onClick={() => setIsOpenModal(true)}
                className="text-[13px] font-medium text-white opacity-90 cursor-pointer"
              >
                {t("signin")}
              </span>
            </button>
          </div>
        </div>
      </nav>

      <Modal isOpen={isModalOpen} onClose={() => setIsOpenModal(false)} />
    </header>
  );
}