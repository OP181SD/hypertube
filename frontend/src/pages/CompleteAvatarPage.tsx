import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfilePicture } from "@/api/users.api";
import { AvatarConfirmStep } from "@/components/auth/AvatarConfirmStep";

function clearAvatarConfirmCookie(): void {
  document.cookie = "oauth_avatar_confirm=; max-age=0; path=/";
}

export default function CompleteAvatarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (file: File | null) => {
    if (!user) {
      navigate("/?auth=failed", { replace: true });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (file) {
        await uploadProfilePicture(user.id, file);
        await refreshUser();
      }
      clearAvatarConfirmCookie();
      navigate("/dashboard", { replace: true });
    } catch {
      setError(t("avatar_update_error"));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-[#1c1c1e] border border-[#424245]">
        <div className="text-center mb-6">
          <div className="text-[#f5f5f7] font-bold text-xl">
            Hyper<span className="colors-title-gradient">Tube</span>
          </div>
        </div>
        <AvatarConfirmStep
          previewUrl={user.profilePictureUrl}
          username={user.username}
          loading={loading}
          error={error}
          onConfirm={finish}
        />
      </div>
    </div>
  );
}
