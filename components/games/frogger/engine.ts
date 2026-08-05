import { SKINS, DEFAULT_SKIN, type Skin } from "../skins";

// Cuadrícula: 16 columnas × 14 filas de 40 px (640 × 560). Fila 0 = arriba.
const COLS = 16;
const ROWS = 14;
const CELL = 40;
const CANVAS_W = COLS * CELL; // 640
const CANVAS_H = ROWS * CELL; // 560

// Zonas verticales fijas (índice de fila, 0 = arriba).
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const START_COL = Math.floor(COLS / 2) - 1; // 7

// 5 bocas destino de 2 columnas cada una; las columnas restantes son huecos letales.
const GOAL_COLS: readonly [number, number][] = [
  [1, 2],
  [4, 5],
  [7, 8],
  [10, 11],
  [13, 14],
];

const JUMP_MS = 120;
const ROUND_TIME_BASE_MS = 15000;
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

type Direction = "up" | "down" | "left" | "right";

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  /** Sólo tortugas: desfase individual del ciclo de inmersión del grupo. */
  phaseOffset?: number;
}

interface Lane {
  row: number;
  speed: number; // px/frame nominal — ver conversión a espacio de celdas en advanceLane()
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
}

export type EngineCallbacks = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
};

export type FroggerEngine = {
  start: () => void;
  stop: () => void;
  setPaused: (paused: boolean) => void;
  restart: () => void;
  forceGameOver: () => void;
  destroy: () => void;
  setSkin: (skin: Skin) => void;
  pressKey: (code: string) => void;
  releaseKey: (code: string) => void;
};

export function createEngine(
  canvas: HTMLCanvasElement,
  callbacks: EngineCallbacks,
  initialSkin?: Skin,
): FroggerEngine {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("2D context not available");
  const ctx: CanvasRenderingContext2D = ctx2d;

  // Skin como variable de closure mutable (nunca constante de módulo): `setSkin()` solo la
  // reasigna, `draw()` la lee en cada frame.
  let skin: Skin = initialSkin ?? SKINS[DEFAULT_SKIN];

  let score = 0;
  let lives = 3;
  let level = 1;
  let paused = false;
  let gameOver = false;
  let running = false;
  let lastTime: number | null = null;
  let animationFrame: number | null = null;

  let lanes: Lane[] = [];
  let goalsOccupied: boolean[] = [false, false, false, false, false];
  let minRowReached = ROW_START;
  let timeRemaining = ROUND_TIME_BASE_MS;
  let riverCycleT = 0;
  let pendingDir: Direction | null = null;

  const frog: Frog = {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    fromCol: START_COL,
    fromRow: ROW_START,
    targetCol: START_COL,
    targetRow: ROW_START,
  };

  function reportScore(v: number) {
    if (v !== score) {
      score = v;
      callbacks.onScoreChange(score);
    }
  }

  function reportLevel(v: number) {
    if (v !== level) {
      level = v;
      callbacks.onLevelChange(level);
    }
  }

  function reportLives(v: number) {
    if (v !== lives) {
      lives = v;
      callbacks.onLivesChange(lives);
    }
  }

  function roundTimeForLevel(lvl: number): number {
    return Math.max(6000, ROUND_TIME_BASE_MS - (lvl - 1) * 1000);
  }

  function randRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function buildLane(
    row: number,
    kind: "road" | "log" | "turtle",
    dir: 1 | -1,
    levelMult: number,
  ): Lane {
    const baseSpeed = kind === "road" ? randRange(1.5, 4) : randRange(1, 3);
    const entities: Entity[] = [];
    let cursor = -COLS;
    while (cursor < COLS * 2) {
      let width: number;
      let type: Entity["type"];
      if (kind === "road") {
        width = Math.random() < 0.55 ? 1 : Math.random() < 0.7 ? 2 : 3;
        type = width >= 3 || Math.random() < 0.3 ? "truck" : "car";
      } else if (kind === "log") {
        width = 2 + Math.floor(Math.random() * 3); // 2-4
        type = "log";
      } else {
        width = 2 + Math.floor(Math.random() * 2); // 2-3
        type = "turtle";
      }
      entities.push({
        col: cursor,
        width,
        type,
        submerged: false,
        phaseOffset:
          type === "turtle" ? Math.random() * TURTLE_CYCLE_MS : undefined,
      });
      cursor += width + randRange(1.5, 3.5);
    }
    return { row, speed: baseSpeed * levelMult, dir, entities };
  }

  function buildLanes(lvl: number): Lane[] {
    const levelMult = Math.pow(1.15, lvl - 1);
    const result: Lane[] = [];
    for (let row = ROW_ROAD_TOP, i = 0; row <= ROW_ROAD_BOT; row++, i++) {
      result.push(buildLane(row, "road", i % 2 === 0 ? -1 : 1, levelMult));
    }
    for (let row = ROW_RIVER_TOP, i = 0; row <= ROW_RIVER_BOT; row++, i++) {
      result.push(
        buildLane(
          row,
          i % 2 === 0 ? "log" : "turtle",
          i % 2 === 0 ? 1 : -1,
          levelMult,
        ),
      );
    }
    return result;
  }

  function laneAt(row: number): Lane | undefined {
    return lanes.find((l) => l.row === row);
  }

  // Desplazamiento en espacio de celdas para una fila en el frame actual (dt en ms).
  function laneDelta(lane: Lane, dt: number): number {
    return (lane.speed * lane.dir * dt) / (16 * CELL);
  }

  function advanceLanes(dt: number) {
    for (const lane of lanes) {
      const delta = laneDelta(lane, dt);
      for (const entity of lane.entities) {
        entity.col += delta;
        if (lane.dir === 1 && entity.col > COLS) {
          entity.col = -entity.width - randRange(0, 2);
        } else if (lane.dir === -1 && entity.col + entity.width < 0) {
          entity.col = COLS + randRange(0, 2);
        }
        if (entity.type === "turtle") {
          const phase =
            (riverCycleT + (entity.phaseOffset ?? 0)) % TURTLE_CYCLE_MS;
          entity.submerged = phase >= TURTLE_VISIBLE_MS;
        }
      }
    }
  }

  function checkRoadCollision(col: number, row: number): boolean {
    const lane = laneAt(row);
    if (!lane) return false;
    return lane.entities.some((e) => col >= e.col && col < e.col + e.width);
  }

  /** Entidad de río que soporta la columna dada en esa fila, o null si no hay soporte. */
  function getSupport(col: number, row: number): Entity | null {
    const lane = laneAt(row);
    if (!lane) return null;
    const entity = lane.entities.find(
      (e) => col >= e.col && col < e.col + e.width,
    );
    if (!entity) return null;
    if (entity.type === "turtle" && entity.submerged) return null;
    return entity;
  }

  function isRiverRow(row: number): boolean {
    return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
  }

  function isSafeRow(row: number): boolean {
    return row === ROW_SAFE_MID || row === ROW_START;
  }

  function isRoadRow(row: number): boolean {
    return row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
  }

  function resetFrogPosition() {
    frog.col = START_COL;
    frog.row = ROW_START;
    frog.fromCol = START_COL;
    frog.fromRow = ROW_START;
    frog.targetCol = START_COL;
    frog.targetRow = ROW_START;
    frog.animating = false;
    frog.animT = 0;
    pendingDir = null;
  }

  function resetTimer() {
    timeRemaining = roundTimeForLevel(level);
  }

  function killFrog() {
    const next = Math.max(0, lives - 1);
    reportLives(next);
    if (lives <= 0) {
      endGame();
      return;
    }
    resetFrogPosition();
    resetTimer();
  }

  function checkGoal() {
    const bucket = GOAL_COLS.findIndex(
      ([a, b]) => frog.col === a || frog.col === b,
    );
    if (bucket === -1 || goalsOccupied[bucket]) {
      killFrog();
      return;
    }
    goalsOccupied[bucket] = true;
    reportScore(score + 50 + Math.round(timeRemaining / 1000) * 10);
    if (goalsOccupied.every(Boolean)) {
      completeRound();
    }
  }

  function completeRound() {
    resetFrogPosition();
    goalsOccupied = [false, false, false, false, false];
    minRowReached = ROW_START;
    reportScore(score + 200);
    reportLevel(level + 1);
    lanes = buildLanes(level);
    resetTimer();
  }

  function resolveLanding() {
    if (frog.row === ROW_GOALS) {
      checkGoal();
      return;
    }
    if (isRoadRow(frog.row) && checkRoadCollision(frog.col, frog.row)) {
      killFrog();
      return;
    }
    if (isRiverRow(frog.row) && !getSupport(frog.col, frog.row)) {
      killFrog();
      return;
    }
    if (frog.row < minRowReached) {
      minRowReached = frog.row;
      reportScore(score + 10);
    }
  }

  function tryStartJump(dir: Direction) {
    let targetCol = frog.col;
    let targetRow = frog.row;
    if (dir === "up") targetRow -= 1;
    else if (dir === "down") targetRow += 1;
    else if (dir === "left") targetCol -= 1;
    else targetCol += 1;

    if (targetCol < 0 || targetCol >= COLS) return;
    if (targetRow < ROW_GOALS || targetRow > ROW_START) return;

    frog.fromCol = frog.col;
    frog.fromRow = frog.row;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
    frog.animating = true;
    frog.animT = 0;
  }

  function updateFrog(dt: number) {
    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_MS) {
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        frog.animating = false;
        frog.animT = 0;
        resolveLanding();
        if (gameOver) return;
      }
      return;
    }

    if (pendingDir) {
      const dir = pendingDir;
      pendingDir = null;
      tryStartJump(dir);
      return;
    }

    if (isRoadRow(frog.row) && checkRoadCollision(frog.col, frog.row)) {
      killFrog();
      return;
    }

    if (isRiverRow(frog.row)) {
      const support = getSupport(frog.col, frog.row);
      if (!support) {
        killFrog();
        return;
      }
      const lane = laneAt(frog.row);
      if (lane) frog.col += laneDelta(lane, dt);
      if (frog.col < 0 || frog.col >= COLS) {
        killFrog();
      }
    }
  }

  function update(dt: number) {
    advanceLanes(dt);
    riverCycleT += dt;

    updateFrog(dt);
    if (gameOver) return;

    timeRemaining -= dt;
    if (timeRemaining <= 0) {
      timeRemaining = 0;
      killFrog();
    }
  }

  // ---- Dibujo ---------------------------------------------------------------

  function zoneFill(row: number) {
    if (isRoadRow(row)) {
      ctx.fillStyle = skin.bg;
      ctx.fillRect(0, row * CELL, CANVAS_W, CELL);
      return;
    }
    if (isRiverRow(row)) {
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = skin.palette[5];
      ctx.fillRect(0, row * CELL, CANVAS_W, CELL);
      ctx.globalAlpha = 1;
      return;
    }
    // Sólo quedan la fila de bocas (0) y las zonas seguras (7 y 13, isSafeRow).
    const safe = isSafeRow(row);
    ctx.globalAlpha = safe ? 0.24 : 0.22;
    ctx.fillStyle = safe ? skin.palette[3] : skin.accent;
    ctx.fillRect(0, row * CELL, CANVAS_W, CELL);
    ctx.globalAlpha = 1;
  }

  function drawGoals() {
    for (let i = 0; i < GOAL_COLS.length; i++) {
      const [a] = GOAL_COLS[i];
      const x = a * CELL;
      const y = ROW_GOALS * CELL + 8;
      const w = 2 * CELL;
      const h = CELL - 12;
      ctx.strokeStyle = skin.accent;
      ctx.lineWidth = 2;
      ctx.shadowBlur = skin.glow;
      ctx.shadowColor = skin.accent;
      ctx.strokeRect(x + 3, y, w - 6, h);
      ctx.shadowBlur = 0;
      if (goalsOccupied[i]) {
        ctx.fillStyle = skin.palette[3];
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, 12, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawEntity(lane: Lane, entity: Entity) {
    const x = entity.col * CELL;
    const y = lane.row * CELL;
    const w = entity.width * CELL;

    if (entity.type === "car") {
      ctx.fillStyle = skin.palette[4];
      ctx.shadowBlur = skin.glow;
      ctx.shadowColor = skin.palette[4];
      ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(${skin.inkRgb}, 0.8)`;
      ctx.beginPath();
      ctx.arc(x + 8, y + CELL - 8, 4, 0, Math.PI * 2);
      ctx.arc(x + w - 8, y + CELL - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (entity.type === "truck") {
      ctx.fillStyle = skin.palette[7];
      ctx.shadowBlur = skin.glow;
      ctx.shadowColor = skin.palette[7];
      ctx.fillRect(x + 2, y + 4, w - 4, CELL - 8);
      ctx.shadowBlur = 0;
      const cabW = Math.min(CELL - 6, w - 4);
      const cabX = lane.dir === 1 ? x + w - cabW - 2 : x + 2;
      ctx.fillStyle = skin.palette[6];
      ctx.fillRect(cabX, y + 4, cabW, CELL - 8);
      return;
    }
    if (entity.type === "log") {
      ctx.fillStyle = skin.palette[6];
      ctx.fillRect(x + 1, y + 8, w - 2, CELL - 16);
      ctx.strokeStyle = `rgba(${skin.inkRgb}, 0.3)`;
      ctx.lineWidth = 1;
      for (let lx = x + 6; lx < x + w - 4; lx += 10) {
        ctx.beginPath();
        ctx.moveTo(lx, y + 9);
        ctx.lineTo(lx, y + CELL - 9);
        ctx.stroke();
      }
      return;
    }
    // turtle
    const count = entity.width;
    for (let i = 0; i < count; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (entity.submerged) {
        ctx.strokeStyle = `rgba(${skin.inkRgb}, 0.25)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = skin.palette[3];
        ctx.shadowBlur = skin.glow;
        ctx.shadowColor = skin.palette[3];
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(${skin.inkRgb}, 0.4)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawFrog() {
    const t = Math.min(1, frog.animT / JUMP_MS);
    const col = frog.animating
      ? frog.fromCol + (frog.targetCol - frog.fromCol) * t
      : frog.col;
    const row = frog.animating
      ? frog.fromRow + (frog.targetRow - frog.fromRow) * t
      : frog.row;
    const hop = frog.animating ? Math.sin(t * Math.PI) * 8 : 0;
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2 - hop;
    const legSpread = frog.animating ? 6 + hop * 0.5 : 3;

    ctx.fillStyle = skin.palette[3];
    ctx.shadowBlur = skin.glow;
    ctx.shadowColor = skin.palette[3];
    // Patas
    ctx.beginPath();
    ctx.ellipse(cx - legSpread - 6, cy + 6, 6, 4, 0.4, 0, Math.PI * 2);
    ctx.ellipse(cx + legSpread + 6, cy + 6, 6, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Cuerpo
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Ojos
    ctx.fillStyle = skin.ink;
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 8, 3.5, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.bg;
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 8, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy - 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function timeBarColor(fraction: number): string {
    if (fraction > 0.5) return skin.palette[3];
    if (fraction > 0.25) return skin.palette[1];
    return skin.palette[4];
  }

  function drawHud() {
    ctx.shadowBlur = 0;
    ctx.font = `bold 14px ${skin.font}`;
    ctx.fillStyle = skin.ink;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(String(score).padStart(5, "0"), 6, 4);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, CANVAS_W / 2, 4);

    ctx.textAlign = "right";
    const iconY = 12;
    for (let i = 0; i < lives; i++) {
      ctx.fillStyle = skin.palette[3];
      ctx.beginPath();
      ctx.ellipse(CANVAS_W - 10 - i * 16, iconY, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = "left";

    const fraction = Math.max(0, timeRemaining / roundTimeForLevel(level));
    ctx.fillStyle = `rgba(${skin.inkRgb}, 0.15)`;
    ctx.fillRect(0, 0, CANVAS_W, 4);
    ctx.fillStyle = timeBarColor(fraction);
    ctx.fillRect(0, 0, CANVAS_W * fraction, 4);
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    for (let row = 0; row < ROWS; row++) zoneFill(row);
    drawGoals();
    for (const lane of lanes) {
      for (const entity of lane.entities) drawEntity(lane, entity);
    }
    drawFrog();
    drawHud();
  }

  function endGame() {
    gameOver = true;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    callbacks.onGameOver(score);
  }

  function initGame() {
    lanes = buildLanes(1);
    goalsOccupied = [false, false, false, false, false];
    minRowReached = ROW_START;
    reportScore(0);
    reportLevel(1);
    lives = 3;
    callbacks.onLivesChange(lives);
    resetTimer();
    resetFrogPosition();
    paused = false;
    gameOver = false;
    riverCycleT = 0;
  }

  function setKeyState(code: string, isDown: boolean) {
    if (!isDown) return;
    if (paused || gameOver) return;
    switch (code) {
      case "ArrowUp":
        pendingDir = "up";
        break;
      case "ArrowDown":
        pendingDir = "down";
        break;
      case "ArrowLeft":
        pendingDir = "left";
        break;
      case "ArrowRight":
        pendingDir = "right";
        break;
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    setKeyState(e.code, true);
  }

  function loop(ts: number) {
    if (!running) return;
    if (!paused && !gameOver) {
      const dt = lastTime === null ? 0 : ts - lastTime;
      lastTime = ts;
      update(Math.min(dt, 100));
    } else {
      lastTime = ts;
    }
    if (gameOver) return;
    draw();
    animationFrame = requestAnimationFrame(loop);
  }

  initGame();

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = null;
      window.addEventListener("keydown", onKeyDown);
      animationFrame = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      window.removeEventListener("keydown", onKeyDown);
    },
    setPaused(next: boolean) {
      paused = next;
    },
    restart() {
      paused = false;
      initGame();
      if (running && animationFrame === null) {
        lastTime = null;
        animationFrame = requestAnimationFrame(loop);
      }
    },
    forceGameOver() {
      if (gameOver) return;
      endGame();
    },
    setSkin(next: Skin) {
      skin = next;
      draw();
    },
    pressKey(code: string) {
      setKeyState(code, true);
    },
    releaseKey() {
      // Frogger no tiene estado de tecla mantenida: cada salto es de un solo disparo.
    },
    destroy() {
      running = false;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
