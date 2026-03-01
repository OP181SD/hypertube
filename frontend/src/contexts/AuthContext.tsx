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
  refreshTokens,
  forgotPassword as forgotPwdApi,
  resetPassword as resetPwdApi,
} from "@/api/auth.api";
import { getUser, updateUser as updateUserApi } from "@/api/users.api";
import client from "@/api/client";
import i18n from "@/i18n";
import type {
  UserPublic,
  RegisterRequest,
  MessageResponse,
} from "@/types/api";

const LANG_TO_I18N: Record<string, string> = {
  EN: "en", FR: "fr", ES: "es", IT: "it", PT: "pt",
  DE: "de", RU: "ru", JA: "ja", KO: "ko", ZH: "zh",
  AR: "ar", NL: "nl", PL: "pl", SV: "sv", TR: "tr",
};
const I18N_TO_LANG: Record<string, string> = {
  en: "EN", fr: "FR", es: "ES", it: "IT", pt: "PT",
  de: "DE", ru: "RU", ja: "JA", ko: "KO", zh: "ZH",
  ar: "AR", nl: "NL", pl: "PL", sv: "SV", tr: "TR",
};

interface AuthContextValue {
  user: UserPublic | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
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

function decodeToken(token: string): { sub: string } | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function syncLanguage(user: UserPublic) {
  if (user.language) {
    const lng = LANG_TO_I18N[user.language] ?? "en";
    i18n.changeLanguage(lng);
  }
}

export { I18N_TO_LANG };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearAuth = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setError(null);
  }, []);

  const restoreSession = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    const decoded = decodeToken(token);
    if (!decoded?.sub) {
      clearAuth();
      setLoading(false);
      return;
    }

    try {
      const u = await getUser(decoded.sub);
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
        if (axiosErr.response?.status === 401 && original && !original._retry) {
          original._retry = true;
          const rt = localStorage.getItem("refresh_token");
          if (rt) {
            try {
              const tokens = await refreshTokens(rt);
              localStorage.setItem("access_token", tokens.access_token);
              localStorage.setItem("refresh_token", tokens.refresh_token);
              if (original.headers) {
                original.headers.Authorization = `Bearer ${tokens.access_token}`;
              }
              return client(original as Parameters<typeof client>[0]);
            } catch {
              clearAuth();
            }
          } else {
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
        const tokens = await loginApi({ username, password });
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);

        const decoded = decodeToken(tokens.access_token);
        if (decoded?.sub) {
          const u = await getUser(decoded.sub);
          setUser(u);
          syncLanguage(u);
        }
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
        const tokens = await registerApi(data);
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);

        const decoded = decodeToken(tokens.access_token);
        if (decoded?.sub) {
          const u = await getUser(decoded.sub);
          setUser(u);
          syncLanguage(u);
        }
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

  const logout = useCallback(async () => {
    const rt = localStorage.getItem("refresh_token");
    try {
      await logoutApi(rt || undefined);
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
