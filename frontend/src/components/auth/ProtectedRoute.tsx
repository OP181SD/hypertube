import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Send anonymous visitors back to the public home page and signal the
    // Navbar to open the auth modal (sign-up / sign-in funnel).
    return <Navigate to="/?auth=login" replace />;
  }

  return <>{children}</>;
}
