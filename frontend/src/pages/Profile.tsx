import { useState } from "react";

export function Profile() {
  const [activeTab, setActiveTab] = useState<"profile" | "settings">("profile");

  const user = {
    firstName: "Yassine",
    lastName: "Yassine",
    photo: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop",
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 sm:px-10 md:px-20 pt-16 flex flex-col items-center">

      {/* Avatar */}
      {/* Avatar avec cadre dégradé style Insta */}
      <div className="flex flex-col items-center mb-12">
        <div className="relative inline-block rounded-full p-1 bg-linear-to-tr from-[#795EF0] via-[#C270ED] to-[#38BDF8]">
          <img
            src={user.photo}
            alt="Avatar"
            className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover ring-2 ring-black/20 transition-transform duration-300 hover:scale-105"
          />

          <button
            aria-label="Modifier la photo"
            className="absolute bottom-2 right-2 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M16.862 3.487a1.75 1.75 0 0 1 2.474 2.474l-10.5 10.5a1.25 1.25 0 0 1-.557.328l-4 1a.75.75 0 0 1-.927-.927l1-4a1.25 1.25 0 0 1 .328-.557l10.5-10.5zM19.5 5.5l-1.5-1.5M5 18h4l10.5-10.5" />
            </svg>
          </button>

        </div>

        {/* Nom inchangé */}
        <h1 className="mt-5 text-3xl sm:text-4xl font-semibold tracking-wide text-white">
          {user.firstName} {user.lastName}
        </h1>
      </div>


      {/* Tabs */}
      <div className="flex justify-center gap-6 mb-8">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-6 py-3 rounded-lg font-semibold text-lg transition ${activeTab === "profile"
            ? "bg-white/10 text-white shadow-lg"
            : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
        >
          Profil
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-6 py-3 rounded-lg font-semibold text-lg transition ${activeTab === "settings"
            ? "bg-white/10 text-white shadow-lg"
            : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
        >
          Paramètres
        </button>
      </div>

      {/* Content */}
      <div className="max-w-3xl w-full">
        {activeTab === "profile" && (
          <div className="text-center text-white/80">
            <p>Bienvenue sur ton profil Apple TV-style. Ici, tu peux voir les infos utilisateur.</p>
          </div>
        )}
        {activeTab === "settings" && (
          <div className="text-center text-white/70">
            <p>Modifier les paramètres de ton compte : nom, prénom, photo, etc. Parti de farouk</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
