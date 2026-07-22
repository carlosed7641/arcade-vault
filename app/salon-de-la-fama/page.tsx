"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES } from "@/lib/data";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";

type HallRow = {
  rank: number;
  username: string;
  score: number;
  date: string;
};

export default function HallOfFamePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState(GAMES[0].id);
  const [rows, setRows] = useState<HallRow[]>([]);
  const [loading, setLoading] = useState(true);

  const game = GAMES.find((g) => g.id === tab)!;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const supabase = createClient();
    supabase
      .from("scores")
      .select("score, created_at, profiles(username)")
      .eq("game_id", tab)
      .order("score", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (cancelled) return;

        const seen = new Set<string>();
        const best: HallRow[] = [];
        for (const entry of (data ?? []) as Array<{
          score: number;
          created_at: string;
          profiles: { username: string }[];
        }>) {
          const username = entry.profiles?.[0]?.username;
          if (!username || seen.has(username)) continue;
          seen.add(username);
          best.push({
            rank: best.length + 1,
            username,
            score: entry.score,
            date: new Date(entry.created_at).toLocaleDateString("es-ES"),
          });
          if (best.length === 12) break;
        }

        setRows(best);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  const you = useMemo(
    () => (user ? rows.find((r) => r.username === user.username) : undefined),
    [rows, user],
  );

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{ textAlign: "center", padding: "48px 0" }}
          className="mono"
        >
          CARGANDO PUNTUACIONES…
        </div>
      ) : rows.length === 0 ? (
        <div
          style={{ textAlign: "center", padding: "48px 0" }}
          className="mono"
        >
          SÉ EL PRIMERO EN DEJAR TU MARCA EN {game.title}
        </div>
      ) : (
        <>
          {rows.length >= 3 && (
            <div className="podium">
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].username}</div>
                <div className="score">
                  {rows[1].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[1].date}</div>
              </div>
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div
                  className="rank-num"
                  style={{ fontSize: 36, marginTop: 4 }}
                >
                  01
                </div>
                <div className="name">{rows[0].username}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[0].date}</div>
              </div>
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].username}</div>
                <div className="score">
                  {rows[2].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[2].date}</div>
              </div>
            </div>
          )}

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.username}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.username}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {you && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(you.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {you.username}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {you.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{you.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button className="btn lg" onClick={() => router.push("/biblioteca")}>
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  );
}
