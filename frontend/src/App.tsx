import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import MovieDetailPage from "@/pages/MovieDetailPage";
import UserProfilePage from "@/pages/UserProfilePage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import OAuthCallback from "@/pages/OAuthCallback";
import CompleteAvatarPage from "@/pages/CompleteAvatarPage";
import Navbar from "@/components/layout/home/Navbar";
import AuthNavbar from "@/components/layout/AuthNavbar";
import Footer from "@/components/layout/Footer";
import NotFound from "@/components/layout/NotFound";
import { AuthModalProvider } from "@/contexts/AuthModalContext";

import "@/globals.css";

function MainLayout({
  children,
  lockViewport = false,
}: {
  children: React.ReactNode;
  lockViewport?: boolean;
}) {
  return (
    <AuthModalProvider>
      <div
        className={
          lockViewport
            ? "flex h-dvh flex-col overflow-hidden"
            : "flex min-h-dvh flex-col"
        }
      >
        <Navbar />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <Footer />
      </div>
    </AuthModalProvider>
  );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
    </div>
  );
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AuthPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AuthNavbar />
      <main className="flex-1 flex flex-col pt-14 md:pt-16">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <GuestRoute>
                <MainLayout lockViewport>
                  <Home />
                </MainLayout>
              </GuestRoute>
            }
          />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route
            path="/auth/complete-avatar"
            element={
              <ProtectedRoute>
                <CompleteAvatarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <MainLayout>
                <ResetPasswordPage />
              </MainLayout>
            }
          />
          <Route
            path="/verify-email"
            element={
              <MainLayout>
                <VerifyEmailPage />
              </MainLayout>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/movies/:id"
            element={
              <ProtectedRoute>
                <AuthPageLayout>
                  <MovieDetailPage />
                </AuthPageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/:id"
            element={
              <ProtectedRoute>
                <AuthPageLayout>
                  <UserProfilePage />
                </AuthPageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <MainLayout>
                <NotFound />
              </MainLayout>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
