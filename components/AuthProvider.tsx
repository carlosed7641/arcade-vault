"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type User = { name: string } | null;

export type SavedScore = {
  game: string;
  score: number;
  name: string;
  at: number;
};

type AuthContextValue = {
  user: User;
  login: (user: User) => void;
  logout: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    // One-time sync from localStorage (client-only) into the null default
    // used for the server-rendered pass, per the spec's hydration mitigation.
    try {
      const stored = localStorage.getItem(USER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // localStorage unavailable — session stays unauthenticated.
    }
  }, []);

  const login = (nextUser: User) => {
    setUser(nextUser);
    try {
      if (nextUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch {
      // localStorage unavailable — session won't persist across reloads.
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      // localStorage unavailable.
    }
  };

  const saveScore = (entry: Omit<SavedScore, "at">) => {
    try {
      const all: SavedScore[] = JSON.parse(
        localStorage.getItem(SCORES_KEY) || "[]"
      );
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {
      // localStorage unavailable — score won't persist.
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, saveScore }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
