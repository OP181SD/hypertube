import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MovieBrowser } from "@/components/ui/MovieBrowser";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { useAuth } from "@/contexts/AuthContext";
import type { Tab } from "@/types/ui/Tabs";
import { Profile } from "@/pages/Profile";
import { WatchlistPage } from "@/pages/WatchlistPage";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("movies");
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white font-sans">
      <DashboardNavbar
        search={search}
        setSearch={setSearch}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        handleLogout={handleLogout}
      />

      <main className="flex-1 max-w-full">
        {activeTab === "movies" && <MovieBrowser search={search} mediaType="movie" />}
        {activeTab === "series" && <MovieBrowser search={search} mediaType="series" />}
        {activeTab === "watchlist" && (
          <div className="flex flex-col items-center w-full px-3 sm:px-4 md:px-6 lg:px-8 pt-16 md:pt-20">
            <WatchlistPage />
          </div>
        )}
        {activeTab === "profile" && (
          <div className="px-3 sm:px-4 md:px-6 lg:px-8 pt-16 md:pt-20 text-white text-center mt-10">
            <Profile />
          </div>
        )}
      </main>
    </div>
  );
}