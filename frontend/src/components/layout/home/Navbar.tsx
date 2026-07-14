import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "@/components/modal/Modal";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

export default function Navbar() {
  const [isModalOpen, setIsOpenModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();

  const authRedirect = searchParams.get("auth");
  if (authRedirect && !isModalOpen) {
    setIsOpenModal(true);
  }

  useEffect(() => {
    if (authRedirect) {
      setSearchParams({}, { replace: true });
    }
  }, [authRedirect, setSearchParams]);

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
            <LanguageSelector className="bg-black/50 text-white/90 px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-all duration-200 text-xs sm:text-sm cursor-pointer" />

            <button
              type="button"
              onClick={() => setIsOpenModal(true)}
              className="px-4 md:px-5 xl:px-6 py-1 rounded-md border border-white/30 hover:bg-white/10 transition cursor-pointer"
            >
              <span className="text-[13px] font-medium text-white opacity-90">
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
