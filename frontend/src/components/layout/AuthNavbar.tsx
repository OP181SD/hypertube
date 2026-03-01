import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useChangeLanguage } from "@/hooks/useChangeLanguage";

export default function AuthNavbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { changeLanguage, currentLang } = useChangeLanguage();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header>
      <nav className="h-14 md:h-16 px-3 sm:px-4 md:px-6 xl:px-8 backdrop-blur-md bg-black/70 fixed w-full top-0 z-50 border-b border-white/10">
        <div className="flex items-center justify-between h-full max-w-full mx-auto w-full">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center shrink-0"
          >
            <span className="text-xs sm:text-sm md:text-base text-white/70 font-medium">Hyper</span>
            <span className="ml-0.5 sm:ml-1 text-xs sm:text-sm md:text-base font-medium bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
              Tube
            </span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <select
              value={currentLang}
              onChange={(e) => changeLanguage(e.target.value)}
              className="bg-black/50 text-white/90 px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-all duration-200 text-xs sm:text-sm"
            >
              <option value="fr">🇫🇷 Français</option>
              <option value="en">🇬🇧 English</option>
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

            {user?.profilePictureUrl && (
              <img
                // src={user.profilePictureUrl}
                src={`http://localhost:3000${user.profilePictureUrl}`}
                alt={user.username}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-white/20"
              />
            )}

            <button
              onClick={handleLogout}
              className="px-3 lg:px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/10 hover:border-white/40 text-white/90 text-xs lg:text-sm font-medium transition-all duration-300 whitespace-nowrap"
            >
              {t("logout")}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
