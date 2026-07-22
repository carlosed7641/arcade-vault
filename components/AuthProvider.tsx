"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type User = { id: string; username: string } | null;

type AuthContextValue = {
  user: User;
  logout: () => Promise<void>;
  saveScore: (entry: { game: string; score: number }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<User> {
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  return data ? { id: userId, username: data.username } : null;
}

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: User;
}) {
  const [user, setUser] = useState<User>(initialUser);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      setUser(await fetchProfile(supabase, session.user.id));
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  const saveScore = async (entry: { game: string; score: number }) => {
    if (!user) return;
    const supabase = createClient();
    await supabase
      .from("scores")
      .insert({ user_id: user.id, game_id: entry.game, score: entry.score });
  };

  return (
    <AuthContext.Provider value={{ user, logout, saveScore }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
