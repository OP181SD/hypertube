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
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="es">ES</option>
              <option value="it">IT</option>
              <option value="pt">PT</option>
              <option value="de">DE</option>
              <option value="ru">RU</option>
              <option value="ja">JA</option>
              <option value="ko">KO</option>
              <option value="zh">ZH</option>
              <option value="ar">AR</option>
              <option value="nl">NL</option>
              <option value="pl">PL</option>
              <option value="sv">SV</option>
              <option value="tr">TR</option>
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