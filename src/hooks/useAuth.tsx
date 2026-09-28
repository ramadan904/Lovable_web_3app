import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/data";
import type { AuthUser } from "@/lib/types";

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false });

  useEffect(() => {
    let alive = true;
    const off = api.onAuthChange((user) => alive && setState({ user, ready: true }));
    api
      .getUser()
      .then((user) => alive && setState({ user, ready: true }))
      .catch(() => alive && setState({ user: null, ready: true }));
    return () => {
      alive = false;
      off();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
