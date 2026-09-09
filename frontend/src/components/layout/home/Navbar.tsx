import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "@/components/modal/Modal";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useAuthModal } from "@/contexts/AuthModalContext";

export default function Navbar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { isOpen, openAuthModal, closeAuthModal } = useAuthModal();

  const authRedirect = searchParams.get("auth");

  useEffect(() => {
    if (authRedirect) {
      openAuthModal();
      setSearchParams({}, { replace: true });
    }
  }, [authRedirect, openAuthModal, setSearchParams]);

  return (
    <header>
      <nav className="h-12 md:h-13 xl:h-15 px-4 md:px-6 xl:px-8 backdrop-blur-md bg-black/80">
        <div className="flex h-full w-full max-w-400 items-center justify-between mx-auto">
          <div className="mt-px flex shrink-0 items-center text-[16px] font-medium">
            <span className="text-white/90">Hyper</span>
            <span className="colors-title-gradient">Tube</span>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector className="bg-black/50 text-white/90 px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-all duration-200 text-xs sm:text-sm cursor-pointer" />

            <button
              type="button"
              onClick={openAuthModal}
              className="px-4 md:px-5 xl:px-6 py-1 rounded-md border border-white/30 hover:bg-white/10 transition cursor-pointer"
            >
              <span className="text-[13px] font-medium text-white opacity-90">
                {t("signin")}
              </span>
            </button>
          </div>
        </div>
      </nav>

      <Modal isOpen={isOpen} onClose={closeAuthModal} />
    </header>
  );
}
