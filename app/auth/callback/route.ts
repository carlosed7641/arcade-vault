import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function slugifyUsername(raw: string): string {
  const slug = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);

  return slug.length >= 3 ? slug : `player_${slug}`.slice(0, 20);
}

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  metadata: Record<string, unknown>,
  email: string | undefined,
) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) return;

  const candidate =
    (metadata.full_name as string | undefined) ??
    (metadata.user_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    email?.split("@")[0] ??
    "player";

  const baseUsername = slugifyUsername(candidate);
  let username = baseUsername;
  let suffix = 2;
  const MAX_ATTEMPTS = 50;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (!taken) break;

    // Reserve room for the numeric suffix so it never gets truncated away by
    // slice(0, 20) when baseUsername is already 20 chars long (which would
    // otherwise produce the same candidate forever and loop indefinitely).
    const suffixStr = `_${suffix}`;
    username = `${baseUsername.slice(0, 20 - suffixStr.length)}${suffixStr}`;
    suffix += 1;

    if (attempt === MAX_ATTEMPTS - 1) {
      // Extremely unlikely (would need 50 colliding usernames), but guarantee
      // termination with a value that's virtually guaranteed to be unique.
      username = `player_${userId.slice(0, 12)}`;
    }
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId, username });

  if (insertError) {
    // Non-fatal: the user is already authenticated. A missing profile row
    // just means username-dependent UI won't have a value; it's re-attempted
    // on the next OAuth login since ensureProfile re-checks for an existing row.
    console.error("ensureProfile: failed to insert profile", insertError);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("No se pudo completar el inicio de sesión.")}`,
    );
  }

  const supabase = await createClient();
  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("No se pudo completar el inicio de sesión.")}`,
    );
  }

  await ensureProfile(
    supabase,
    data.user.id,
    data.user.user_metadata ?? {},
    data.user.email,
  );

  return NextResponse.redirect(`${origin}/biblioteca`);
}
