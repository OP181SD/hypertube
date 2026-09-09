import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function hasAvatarConfirmCookie(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith("oauth_avatar_confirm=1"));
}

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { restoreSession } = useAuth();

  useEffect(() => {
    restoreSession()
      .then(() => {
        if (hasAvatarConfirmCookie()) {
          navigate("/auth/complete-avatar", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      })
      .catch(() => {
        navigate("/?auth=failed", { replace: true });
      });
  }, [navigate, restoreSession]);

  return null;
}
