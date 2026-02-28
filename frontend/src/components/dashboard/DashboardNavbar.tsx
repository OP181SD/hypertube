import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth, I18N_TO_LANG } from "@/contexts/AuthContext";
import { SearchBar } from "./SearchBar";
import { ProfileIcon } from "./ProfileIcon";
import { Hamburger } from "./Hamburger";
import { MobileMenu } from "./MobileMenu";
import type { Tab } from "@/types/ui/Tabs";

interface Props {
  search: string;
  setSearch: (value: string) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  handleLogout: () => void;
}

export function DashboardNavbar({
  search,
  setSearch,
  activeTab,
  setActiveTab,
  menuOpen,
  setMenuOpen,
  handleLogout,
}: Props) {
  const { t, i18n } = useTranslation();
  const { updateUser } = useAuth();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Auto-close mobile search bar when search is cleared
  useEffect(() => {
    if (!search) setMobileSearchOpen(false);
  }, [search]);

  const changeLanguage = async (lng: string) => {
    await i18n.changeLanguage(lng);
    const backendLang = I18N_TO_LANG[lng];
    
    if (backendLang) {
      try {
        // On précise que backendLang est une des valeurs autorisées pour 'language'
        await updateUser({ language: backendLang as "EN" | "FR" | "ES" | "IT" | "PT" });
      } catch (error) {
        console.error("Failed to sync language with backend", error);
      }
    }
  };

  return (
    <header>
      {/* Mobile search bar — slides in below the navbar */}
      <div
        className={`lg:hidden fixed top-14 left-0 right-0 z-40 bg-black/95 backdrop-blur-lg border-b border-white/10 px-4 py-3 transition-all duration-200 ${
          mobileSearchOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <SearchBar search={search} setSearch={setSearch} autoFocus={mobileSearchOpen} />
      </div>

      <nav className="h-14 md:h-16 px-3 sm:px-4 md:px-6 xl:px-8 backdrop-blur-md bg-black/70 fixed w-full top-0 z-50 border-b border-white/10">
        <div className="flex items-center justify-between h-full max-w-full mx-auto w-full gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
          <div className="flex items-center shrink-0">
            <span className="text-xs sm:text-sm md:text-base text-white/70 font-medium">Hyper</span>
            <span className="ml-0.5 sm:ml-1 text-xs sm:text-sm md:text-base font-medium bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
              Tube
            </span>
          </div>

          <div className="hidden lg:flex flex-1 items-center space-x-1 md:space-x-2 lg:space-x-4">
            <button
              onClick={() => setActiveTab("home")}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "home" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {t("home")}
            </button>
            <button
              onClick={() => setActiveTab("watchlist")}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "watchlist" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {t("watchlist")}
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "profile" ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              {t("profile")}
            </button>
          </div>

          <div className="hidden lg:flex flex-1 max-w-md xl:max-w-lg">
            <SearchBar search={search} setSearch={setSearch} />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 shrink-0 ml-auto">
            <select
              value={i18n.language.split("-")[0]}
              onChange={(e) => changeLanguage(e.target.value)}
              className="bg-black/50 text-white/90 px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-all text-xs sm:text-sm cursor-pointer outline-none"
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="es">ES</option>
              <option value="it">IT</option>
              <option value="pt">PT</option>
            </select>

            <ProfileIcon onClick={() => setActiveTab("profile")} />

            <button
              onClick={handleLogout}
              className="hidden lg:block px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/10 text-white/90 text-sm font-medium transition-all"
            >
              {t("logout")}
            </button>

            {/* Mobile search toggle */}
            <button
              onClick={() => {
                setMobileSearchOpen((prev) => !prev);
                setMenuOpen(false);
              }}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              aria-label="Toggle search"
            >
              {mobileSearchOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => {
                setMenuOpen(!menuOpen);
                setMobileSearchOpen(false);
              }}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10"
            >
              <Hamburger menuOpen={menuOpen} />
            </button>
          </div>
        </div>
      </nav>

      <MobileMenu
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
      />
    </header>
  );
}