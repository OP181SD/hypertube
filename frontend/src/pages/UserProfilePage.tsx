import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getUser } from "@/api/users.api";
import { useAuth } from "@/contexts/AuthContext";
import { AvatarImage } from "@/components/ui/AvatarImage";
import type { UserPublic } from "@/types/api";

const LANG_LABELS: Record<string, string> = {
  EN: "English",
  FR: "Fran\u00e7ais",
  ES: "Espa\u00f1ol",
};

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // If viewing own profile, redirect to dashboard profile tab
    if (currentUser && currentUser.id === id) {
      navigate("/dashboard", { replace: true });
      return;
    }

    let ignore = false; // Flag to prevent race conditions

    const fetchUserProfile = async () => {
      // 1. Reset state before fetching (wrapped in the async function)
      setLoading(true);
      setError(null);

      try {
        // 2. Await the API call
        const data = await getUser(id);
        
        // 3. Only update state if the component hasn't unmounted or id hasn't changed
        if (!ignore) {
          setProfile(data);
        }
      } catch {
        if (!ignore) {
          setError(t("user_not_found"));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchUserProfile();

    // Cleanup function runs when the component unmounts or when the dependencies (like `id`) change
    return () => {
      ignore = true; 
    };
  }, [id, t, currentUser, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
          {t("loading")}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60 text-sm">{error ?? t("user_not_found")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 sm:px-10 md:px-20 pt-16 flex flex-col items-center">
      <button
        onClick={() => navigate(-1)}
        className="self-start mb-6 text-white/60 hover:text-white text-sm flex items-center gap-1 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t("back")}
      </button>

      <div className="flex flex-col items-center mb-10">
        <div className="rounded-full p-1 bg-linear-to-tr from-[#795EF0] via-[#C270ED] to-[#38BDF8]">
          <AvatarImage
            profilePictureUrl={profile.profilePictureUrl}
            username={profile.username}
            className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover ring-2 ring-black/20"
          />
        </div>

        <h1 className="mt-5 text-3xl sm:text-4xl font-semibold tracking-wide text-white">
          {profile.firstName} {profile.lastName}
        </h1>
        <p className="text-white/50 text-sm mt-1">@{profile.username}</p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="bg-white/5 rounded-xl p-4">
          <span className="text-white/50 text-xs block mb-1">{t("username")}</span>
          <span className="text-white">{profile.username}</span>
        </div>

        <div className="bg-white/5 rounded-xl p-4">
          <span className="text-white/50 text-xs block mb-1">{t("full_name")}</span>
          <span className="text-white">{profile.firstName} {profile.lastName}</span>
        </div>

        <div className="bg-white/5 rounded-xl p-4">
          <span className="text-white/50 text-xs block mb-1">{t("language")}</span>
          <span className="text-white">{LANG_LABELS[profile.language] ?? profile.language}</span>
        </div>
      </div>
    </div>
  );
}
