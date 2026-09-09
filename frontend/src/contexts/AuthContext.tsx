import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  login as loginApi,
  register as registerApi,
  logout as logoutApi,
  refresh as refreshApi,
  forgotPassword as forgotPwdApi,
  resetPassword as resetPwdApi,
  verifyEmail as verifyEmailApi,
  resendVerification as resendVerificationApi,
} from "@/api/auth.api";
import { getMe, getUser, updateUser as updateUserApi, type UpdateUserPayload } from "@/api/users.api";
import client from "@/api/client";
import i18n from "@/i18n";
import type {
  UserPublic,
  RegisterRequest,
  MessageResponse,
} from "@/types/api";
import { LANG_TO_I18N } from "@/constants/language";

interface AuthContextValue {
  user: UserPublic | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterRequest, avatar?: File) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<MessageResponse>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<MessageResponse>;
  resetPassword: (token: string, password: string) => Promise<MessageResponse>;
  restoreSession: () => Promise<void>;
  updateUser: (data: UpdateUserPayload) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function syncLanguage(user: UserPublic) {
  if (user.language) {
    const lng = LANG_TO_I18N[user.language] ?? "en";
    i18n.changeLanguage(lng);
  }
}

const ACCESS_REFRESH_MS = 10 * 60 * 1000;
/** Access JWT is 15m — refresh before the next call if the last one is this old. */
const ACCESS_STALE_MS = 10 * 60 * 1000;

const SKIP_REFRESH_401 = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/oauth/token",
];

function shouldSkipRefresh(url?: string): boolean {
  return !!url && SKIP_REFRESH_401.some((path) => url.includes(path));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);

  const [loading, setLoading] = useState(() =>
    document.cookie.includes("has_session=1"),
  );
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const lastRefreshAt = useRef(0);

  const clearAuth = useCallback(() => {
    document.cookie = "has_session=; max-age=0; path=/";
    setUser(null);
    setError(null);
  }, []);

  const silentRefresh = useCallback((): Promise<void> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshApi()
        .then(() => {
          lastRefreshAt.current = Date.now();
        })
        .finally(() => {
          refreshInFlight.current = null;
        });
    }
    return refreshInFlight.current;
  }, []);

  const restoreSession = useCallback(async () => {
    if (!document.cookie.includes("has_session=1")) {
      return;
    }
    try {
      await silentRefresh();
      const u = await getMe();
      setUser(u);
      syncLanguage(u);
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [clearAuth, silentRefresh]);

  useEffect(() => {

    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const reqId = client.interceptors.request.use(async (config) => {
      if (shouldSkipRefresh(config.url))
        return config;
      if (!document.cookie.includes("has_session=1"))
        return config;
      if (Date.now() - lastRefreshAt.current < ACCESS_STALE_MS)
        return config;
      try {
        await silentRefresh();
      } catch {
        /* 401 on the request itself will clear the session */
      }
      return config;
    });

    const id = client.interceptors.response.use(
      (response) => response,
      async (err: unknown) => {
        const axiosErr = err as {
          config?: { _retry?: boolean; headers?: Record<string, string> };
          response?: { status: number };
        };
        const original = axiosErr.config;
        if (
          axiosErr.response?.status === 401 &&
          original &&
          !original._retry &&
          !shouldSkipRefresh((original as { url?: string }).url)
        ) {
          original._retry = true;
          try {
            await silentRefresh();
            return client(original as Parameters<typeof client>[0]);
          } catch {
            clearAuth();
          }
        }
        return Promise.reject(err);
      },
    );

    return () => {
      client.interceptors.request.eject(reqId);
      client.interceptors.response.eject(id);
    };
  }, [clearAuth, silentRefresh]);

  useEffect(() => {
    if (!user) return;
    const renew = () => {
      void silentRefresh().catch(() => clearAuth());
    };
    const id = setInterval(renew, ACCESS_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") renew();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, silentRefresh, clearAuth]);

  const login = useCallback(
    async (username: string, password: string) => {
      setError(null);
      try {
        await loginApi({ username, password });
        lastRefreshAt.current = Date.now();
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
    async (data: RegisterRequest, avatar?: File) => {
      setError(null);
      try {
        await registerApi(data, avatar);
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

  const verifyEmail = useCallback(async (token: string) => {
    setError(null);
    try {

      await verifyEmailApi(token);
      const u = await getMe();
      setUser(u);
      syncLanguage(u);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string | string[] } };
      };
      const message =
        axiosErr?.response?.data?.message || "Verification failed";
      setError(Array.isArray(message) ? message[0] : message);
      throw err;
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    return resendVerificationApi(email);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {

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
        verifyEmail,
        resendVerification,
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
