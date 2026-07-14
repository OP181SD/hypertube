import { useTranslation } from "react-i18next";
import type { Tab } from "@/types/ui/Tabs";

interface Props {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  handleLogout: () => void;
}

export function MobileMenu({ menuOpen, setMenuOpen, activeTab, setActiveTab, handleLogout }: Props) {
  const { t } = useTranslation();

  const tabLabel: Record<Tab, string> = {
    home: "movies",
    series: "series",
    watchlist: "watchlist",
    profile: "profile",
    settings: "settings",
  };

  return (
    <>
      <div className={`lg:hidden fixed top-14 left-0 right-0 w-full bg-black/95 backdrop-blur-lg border-b border-white/10 shadow-2xl transition-all duration-300 z-40 ${menuOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 max-w-full">
          <div className="flex flex-col space-y-1.5 sm:space-y-2">
            {(["home", "series", "watchlist"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setMenuOpen(false);
                }}
                className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-left text-sm sm:text-base font-medium transition-all duration-200 cursor-pointer ${
                  activeTab === tab ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/10"
                }`}
              >
                {t(tabLabel[tab])}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              handleLogout();
              setMenuOpen(false);
            }}
            className="lg:hidden w-full px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-white/20 hover:bg-white/10 hover:border-white/40 text-white/90 text-xs sm:text-sm font-medium transition-all duration-300 cursor-pointer"
          >
            {t("logout")}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30 top-14"
          onClick={() => setMenuOpen(false)}
        ></div>
      )}
    </>
  );
}
