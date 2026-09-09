import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { AvatarImage } from "@/components/ui/AvatarImage";

export default function AuthNavbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {

    }
    navigate("/");
  };

  return (
    <header>
      <nav className="h-14 md:h-16 px-3 sm:px-4 md:px-6 xl:px-8 backdrop-blur-md bg-black/70 fixed w-full top-0 z-50 border-b border-white/10">
        <div className="flex items-center justify-between h-full max-w-full mx-auto w-full">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center shrink-0 cursor-pointer"
          >
            <span className="text-xs sm:text-sm md:text-base text-white/70 font-medium">Hyper</span><span className="text-xs sm:text-sm md:text-base font-medium bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">Tube</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector className="bg-black/50 text-white/90 px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-all duration-200 text-xs sm:text-sm cursor-pointer" />

            <AvatarImage
              profilePictureUrl={user?.profilePictureUrl}
              username={user?.username ?? "guest"}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/20"
            />

            <button
              onClick={handleLogout}
              className="px-3 lg:px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/10 hover:border-white/40 text-white/90 text-xs lg:text-sm font-medium transition-all duration-300 whitespace-nowrap cursor-pointer"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
