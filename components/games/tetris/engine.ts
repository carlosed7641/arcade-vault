const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW_BLOCK = 30;

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

const COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
] as const;

const PIECES: readonly (readonly number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

type Piece = {
  type: number;
  shape: number[][];
  x: number;
  y: number;
};

export type EngineCallbacks = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
};

export type TetrisEngine = {
  start: () => void;
  stop: () => void;
  setPaused: (paused: boolean) => void;
  restart: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

export function createEngine(
  boardCanvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks: EngineCallbacks,
): TetrisEngine {
  const ctx2d = boardCanvas.getContext("2d");
  const nextCtx2d = nextCanvas.getContext("2d");
  if (!ctx2d || !nextCtx2d) throw new Error("2D context not available");
  const ctx: CanvasRenderingContext2D = ctx2d;
  const nextCtx: CanvasRenderingContext2D = nextCtx2d;

  let board: number[][] = createBoard();
  let current: Piece;
  let next: Piece;
  let score = 0;
  let level = 1;
  let lines = 0;
  let paused = false;
  let gameOver = false;
  let running = false;
  let lastTime: number | null = null;
  let dropAccum = 0;
  let dropInterval = 1000;
  let animationFrame: number | null = null;

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const template = PIECES[type];
    if (!template) throw new Error("invalid piece type");
    const shape = template.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

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

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      reportScore(score + (LINE_SCORES[cleared] || 0) * level);
      reportLevel(Math.floor(lines / 10) + 1);
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    reportScore(score + (gy - current.y) * 2);
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      reportScore(score + 1);
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
    drawNext();
  }

  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    const color = COLORS[colorIndex];
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color as string;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, board[r][c], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            ctx,
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            0.2,
          );

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          ctx,
          current.x + c,
          current.y + r,
          current.shape[r][c],
          BLOCK,
        );
  }

  function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], PREVIEW_BLOCK);
  }

  function endGame() {
    gameOver = true;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    callbacks.onGameOver(score);
  }

  function initGame() {
    board = createBoard();
    reportScore(0);
    lines = 0;
    reportLevel(1);
    paused = false;
    gameOver = false;
    dropInterval = 1000;
    dropAccum = 0;
    lastTime = null;
    next = randomPiece();
    spawn();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  }

  function loop(ts: number) {
    if (!running) return;
    if (!paused && !gameOver) {
      const dt = lastTime === null ? 0 : ts - lastTime;
      lastTime = ts;
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) {
          current.y++;
        } else {
          lockPiece();
        }
      }
    } else {
      lastTime = ts;
    }
    if (gameOver) return;
    draw();
    animationFrame = requestAnimationFrame(loop);
  }

  initGame();
  callbacks.onLivesChange(0);

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
    destroy() {
      running = false;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
