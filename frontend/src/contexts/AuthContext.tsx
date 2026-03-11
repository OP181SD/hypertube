import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  login as loginApi,
  register as registerApi,
  logout as logoutApi,
  refresh as refreshApi,
  forgotPassword as forgotPwdApi,
  resetPassword as resetPwdApi,
} from "@/api/auth.api";
import { getMe, getUser, updateUser as updateUserApi } from "@/api/users.api";
import client from "@/api/client";
import i18n from "@/i18n";
import type {
  UserPublic,
  RegisterRequest,
  MessageResponse,
} from "@/types/api";
import { LANG_TO_I18N, I18N_TO_LANG } from "@/constants/language";

export { I18N_TO_LANG };

interface AuthContextValue {
  user: UserPublic | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<MessageResponse>;
  resetPassword: (token: string, password: string) => Promise<MessageResponse>;
  restoreSession: () => Promise<void>;
  updateUser: (data: Partial<Pick<UserPublic, "username" | "email" | "firstName" | "lastName" | "language">>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function syncLanguage(user: UserPublic) {
  if (user.language) {
    const lng = LANG_TO_I18N[user.language] ?? "en";
    i18n.changeLanguage(lng);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearAuth = useCallback(() => {
    document.cookie = "has_session=; max-age=0; path=/";
    setUser(null);
    setError(null);
  }, []);

  const restoreSession = useCallback(async () => {
    if (!document.cookie.includes("has_session=1")) {
      setLoading(false);
      return;
    }
    try {
      const u = await getMe();
      setUser(u);
      syncLanguage(u);
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const id = client.interceptors.response.use(
      (response) => response,
      async (err: unknown) => {
        const axiosErr = err as {
          config?: { _retry?: boolean; headers?: Record<string, string> };
          response?: { status: number };
        };
        const original = axiosErr.config;
        const isRefreshCall = (original as { url?: string })?.url?.includes("/auth/refresh");
        if (axiosErr.response?.status === 401 && original && !original._retry && !isRefreshCall) {
          original._retry = true;
          try {
            await refreshApi();
            return client(original as Parameters<typeof client>[0]);
          } catch {
            clearAuth();
          }
        }
        return Promise.reject(err);
      },
    );

    return () => {
      client.interceptors.response.eject(id);
    };
  }, [clearAuth]);

  const login = useCallback(
    async (username: string, password: string) => {
      setError(null);
      try {
        await loginApi({ username, password });
        const u = await getMe();
        setUser(u);
        syncLanguage(u);
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { data?: { message?: string | string[] } };
        };
        const message =
          axiosErr?.response?.data?.message || "Login failed";
        setError(Array.isArray(message) ? message[0] : message);
        throw err;
      }
    },
    [],
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      setError(null);
      try {
        await registerApi(data);
        const u = await getMe();
        setUser(u);
        syncLanguage(u);
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { data?: { message?: string | string[] } };
        };
        const message =
          axiosErr?.response?.data?.message || "Registration failed";
        setError(Array.isArray(message) ? message[0] : message);
        throw err;
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // still clear local state
    }
    clearAuth();
  }, [clearAuth]);

  const forgotPassword = useCallback(async (email: string) => {
    return forgotPwdApi(email);
  }, []);

  const resetPassword = useCallback(
    async (token: string, password: string) => {
      return resetPwdApi(token, password);
    },
    [],
  );

  const updateUser = useCallback(
    async (data: Partial<Pick<UserPublic, "username" | "email" | "firstName" | "lastName" | "language">>) => {
      if (!user) return;
      const updated = await updateUserApi(user.id, data);
      setUser(updated);
    },
    [user],
  );

  const refreshUser = useCallback(async () => {
    if (!user) return;
    const u = await getUser(user.id);
    setUser(u);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        error,
        clearError,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        restoreSession,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
