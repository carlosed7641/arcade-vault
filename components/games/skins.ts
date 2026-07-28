// Sistema de skins compartido por todos los juegos con engine real.
//
// Cada engine recibe un `Skin` (nunca un string suelto) y lo guarda en una variable de
// closure mutable; `setSkin()` solo reasigna esa variable — nunca recrea el engine ni
// reinicia la partida. Ver `.claude/agents/skin-designer.md` y
// `.claude/skills/add-game/architecture.md` §1 para el contrato completo.
//
// Todo color de trazo/texto (`ink`, `accent`, `palette[i]`) está verificado con contraste
// >= 4.5:1 contra negro puro (#000), que es el fondo real del CRT en toda la app.

export type SkinId = "clasico" | "neon" | "retro";

export type Skin = {
  id: SkinId;
  label: string;
  /** Fondo opaco que pintan los juegos que llenan el canvas entero (ej. Asteroids). */
  bg: string;
  /** Trazo/texto primario. */
  ink: string;
  /** Canales RGB de `ink` sin paréntesis, para interpolar alpha: `rgba(${inkRgb}, ${a})`. */
  inkRgb: string;
  /** Texto/trazo secundario, ya resuelto como rgba() con su propio alpha. */
  inkDim: string;
  /** Acento para elementos destacados del HUD (power-ups, timers). */
  accent: string;
  /** Rejilla / líneas guía de bajo contraste, ya resuelto como rgba(). */
  grid: string;
  /** Canales RGB del color de la llama del propulsor, para interpolar alpha. */
  flameRgb: string;
  /** `ctx.shadowBlur` en px aplicado a trazos y HUD; 0 = sin glow. */
  glow: number;
  /** Familia para `ctx.font`. */
  font: string;
  /** 8 colores para entidades tipadas (piezas de Tetris, tipos de asteroide, etc). */
  palette: readonly string[];
};

export const SKINS: Record<SkinId, Skin> = {
  clasico: {
    id: "clasico",
    label: "Clásico",
    bg: "#000000",
    ink: "#ffffff",
    inkRgb: "255 255 255",
    inkDim: "rgba(255,255,255,0.65)",
    accent: "#00f5ff",
    grid: "rgba(255,255,255,0.06)",
    flameRgb: "255 130 0",
    glow: 0,
    font: "monospace",
    // Idéntica a la paleta original de Tetris — cero regresión visual al elegir el default.
    palette: [
      "#4dd0e1",
      "#ffd54f",
      "#ba68c8",
      "#81c784",
      "#e57373",
      "#90caf9",
      "#ffb74d",
      "#9e9e9e",
    ],
  },
  neon: {
    id: "neon",
    label: "Neon",
    bg: "#05010a",
    ink: "#f5f5ff",
    inkRgb: "245 245 255",
    inkDim: "rgba(245,245,255,0.65)",
    // #ff006e (--magenta del sitio) satisface 4.5:1, pero #ff4d94 lee mejor con glow real.
    accent: "#ff4d94",
    grid: "rgba(0,245,255,0.15)",
    flameRgb: "255 140 0",
    glow: 14,
    font: "monospace",
    palette: [
      "#00f5ff", // I - cyan
      "#f5ff00", // O - yellow
      "#ff4d94", // T - magenta
      "#00ff88", // S - green
      "#ff5c5c", // Z - red
      "#4da6ff", // J - blue
      "#ffa64d", // L - orange
      "#e6e9ff", // N - blanco frío
    ],
  },
  retro: {
    id: "retro",
    label: "Retro",
    bg: "#000000",
    ink: "#ffb000",
    inkRgb: "255 176 0",
    inkDim: "rgba(255,176,0,0.65)",
    accent: "#fff3d6",
    grid: "rgba(255,176,0,0.08)",
    flameRgb: "255 176 0",
    glow: 6,
    font: "monospace",
    // Monitor de fósforo ámbar P3: casi monocromo, las piezas se distinguen por brillo
    // (luminancia), no por matiz — cada tono verificado >= 4.5:1 contra negro.
    palette: [
      "#fff3d6", // I
      "#ffe08a", // O
      "#ffc94d", // T
      "#ffb000", // S
      "#e69500", // Z
      "#cc8400", // J
      "#b37200", // L
      "#a66a00", // N
    ],
  },
};

export const DEFAULT_SKIN: SkinId = "clasico";

export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];
