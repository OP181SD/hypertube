import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import MovieDetailPage from "@/pages/MovieDetailPage";
import MoviePresentationWrapper from "./pages/MoviePresentationWrapper";
import UserProfilePage from "@/pages/UserProfilePage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import OAuthCallback from "@/pages/OAuthCallback";
import Navbar from "@/components/layout/home/Navbar";
import AuthNavbar from "@/components/layout/AuthNavbar";
import Footer from "@/components/layout/Footer";
import NotFound from "@/components/layout/NotFound";

import "@/globals.css";

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
    </div>
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
                <MainLayout>
                  <Home />
                </MainLayout>
              </GuestRoute>
            }
          />
          <Route path="/auth/callback" element={<OAuthCallback />} />
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
            path="/movies/preview/:id"
            element={
              <ProtectedRoute>
                <AuthPageLayout>
                  <MoviePresentationWrapper />
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
