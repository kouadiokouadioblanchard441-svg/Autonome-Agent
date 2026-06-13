import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type AuthRole = "admin" | "client" | null;

export interface AuthUser {
  email: string;
  name: string;
  accountId?: number;
}

interface AuthState {
  role: AuthRole;
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; role?: AuthRole; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AuthRole>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.role) {
          setRole(data.role);
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<{ ok: boolean; role?: AuthRole; error?: string }> {
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (r.ok && data.role) {
        setRole(data.role as AuthRole);
        setUser(data.user);
        return { ok: true, role: data.role as AuthRole };
      }
      return { ok: false, error: data.error ?? "Identifiants invalides" };
    } catch {
      return { ok: false, error: "Erreur de connexion au serveur" };
    }
  }

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setRole(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ role, user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
