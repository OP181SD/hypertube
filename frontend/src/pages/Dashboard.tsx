import { useState } from "react";
import { Mockup } from "@/components/ui/Mockup";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import type { Tab } from "@/types/ui/Tabs";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    console.log("Déconnecté !");
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

      <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 pt-16 md:pt-20 max-w-full">
        {activeTab === "home" && <Mockup />}
        {activeTab === "profile" && (
          <div className="text-white text-center mt-10">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Page Profil</h2>
            <p className="text-sm sm:text-base text-white/70">(Parti de nesrine)</p>
          </div>
        )}
        {activeTab === "settings" && (
          <div className="text-white text-center mt-10">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Page Paramètres</h2>
            <p className="text-sm sm:text-base text-white/70">(Parti de farouk)</p>
          </div>
        )}
      </main>
    </div>
  );
}
