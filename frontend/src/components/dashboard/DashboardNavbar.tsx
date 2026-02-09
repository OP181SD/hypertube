import { useTranslation } from "react-i18next";
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

function renderNavButtons(
  activeTab: Tab,
  setActiveTab: (tab: Tab) => void,
  t: (key: string) => string
) {
  const tabs: Tab[] = ["home", "profile"];

  return tabs.map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-2 md:px-3 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-all duration-200 ${activeTab === tab ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
        }`}
    >
      {t(tab)}
    </button>
  ));
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

  const changeLanguage = (lng: string) => i18n.changeLanguage(lng);

  return (
    <header>
      <nav className="h-14 md:h-16 px-3 sm:px-4 md:px-6 xl:px-8 backdrop-blur-md bg-black/70 fixed w-full top-0 z-50 border-b border-white/10">
        <div className="flex items-center justify-between h-full max-w-full mx-auto w-full gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
          <div className="flex items-center shrink-0">
            <span className="text-xs sm:text-sm md:text-base text-white/70 font-medium">Hyper</span>
            <span className="ml-0.5 sm:ml-1 text-xs sm:text-sm md:text-base font-medium bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-purple-500">
              Tube
            </span>
          </div>

          <div className="hidden lg:flex flex-1 items-center space-x-1 md:space-x-2 lg:space-x-4 shrink-0">
            {renderNavButtons(activeTab, setActiveTab, t)}
          </div>

          <div className="hidden lg:flex flex-1 max-w-md xl:max-w-lg">
            <SearchBar
              search={search}
              setSearch={setSearch}
            />
          </div>


          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 shrink-0 ml-auto">

            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="bg-black/50 text-white/90 px-2 py-1 rounded-md border border-white/20 hover:bg-white/10 transition-all duration-200 text-xs sm:text-sm"
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>


            <ProfileIcon onClick={() => setActiveTab("profile")} />


            <button
              onClick={handleLogout}
              className="hidden lg:block px-3 lg:px-4 xl:px-5 py-1.5 rounded-full border border-white/20 hover:bg-white/10 hover:border-white/40 text-white/90 text-xs lg:text-sm font-medium transition-all duration-300 whitespace-nowrap"
            >
              {t("logout")}
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors duration-300"
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
        search={search}
        setSearch={setSearch}
      />
    </header>
  );
}
