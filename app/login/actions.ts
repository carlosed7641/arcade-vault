"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SignupPayload = {
  username: string;
  email: string;
  password: string;
};
export type LoginPayload = { username: string; password: string };
export type AuthResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_LOGIN_ERROR = "Usuario o contraseña incorrectos.";

export async function signup({
  username,
  email,
  password,
}: SignupPayload): Promise<AuthResult> {
  const trimmedUsername = username.trim();

  if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
    return {
      ok: false,
      error: "El usuario debe tener entre 3 y 20 caracteres.",
    };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Correo inválido." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", trimmedUsername)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Ese nombre de usuario ya está en uso." };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !signUpData.user) {
    return {
      ok: false,
      error: signUpError?.message ?? "No se pudo crear la cuenta.",
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: signUpData.user.id, username: trimmedUsername });

  if (profileError) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(signUpData.user.id);
    return { ok: false, error: "Ese nombre de usuario ya está en uso." };
  }

  return { ok: true };
}

export async function signin({
  username,
  password,
}: LoginPayload): Promise<AuthResult> {
  const trimmedUsername = username.trim();

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", trimmedUsername)
    .maybeSingle();

  if (!profile) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const admin = createAdminClient();
  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(profile.id);

  if (userError || !userData.user?.email) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password,
  });

  if (signInError) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  return { ok: true };
}
