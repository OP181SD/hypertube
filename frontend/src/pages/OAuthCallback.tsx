import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { restoreSession } = useAuth();

  useEffect(() => {
    restoreSession().then(() => {
      navigate("/dashboard", { replace: true });
    });
  }, [navigate, restoreSession]);

  return null;
}
