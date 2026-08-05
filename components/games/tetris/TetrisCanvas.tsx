"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createEngine, type TetrisEngine } from "./engine";
import { SKINS, DEFAULT_SKIN, type Skin } from "../skins";
import { TouchControls } from "../TouchControls";

export type TetrisCanvasHandle = {
  restart: () => void;
  setPaused: (paused: boolean) => void;
  forceGameOver: () => void;
};

type TetrisCanvasProps = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  skin?: Skin;
};

export const TetrisCanvas = forwardRef<TetrisCanvasHandle, TetrisCanvasProps>(
  function TetrisCanvas(
    { onScoreChange, onLivesChange, onLevelChange, onGameOver, skin },
    ref,
  ) {
    const boardRef = useRef<HTMLCanvasElement>(null);
    const nextRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<TetrisEngine | null>(null);

    useImperativeHandle(ref, () => ({
      restart: () => engineRef.current?.restart(),
      setPaused: (paused: boolean) => engineRef.current?.setPaused(paused),
      forceGameOver: () => engineRef.current?.forceGameOver(),
    }));

    useEffect(() => {
      const boardCanvas = boardRef.current;
      const nextCanvas = nextRef.current;
      if (!boardCanvas || !nextCanvas) return;

      const engine = createEngine(
        boardCanvas,
        nextCanvas,
        { onScoreChange, onLivesChange, onLevelChange, onGameOver },
        skin ?? SKINS[DEFAULT_SKIN],
      );
      engineRef.current = engine;
      engine.start();

      return () => {
        engine.destroy();
        engineRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // El prop `skin` no recrea el engine — solo reasigna la variable de closure que
    // `drawBlock`/`drawGrid` leen cada frame, vía `setSkin`.
    useEffect(() => {
      engineRef.current?.setSkin(skin ?? SKINS[DEFAULT_SKIN]);
    }, [skin]);

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <canvas
          ref={boardRef}
          width={300}
          height={600}
          style={{ height: "92%", width: "auto", display: "block" }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Siguiente
          </div>
          <canvas
            ref={nextRef}
            width={120}
            height={120}
            style={{ height: "22%", width: "auto", display: "block" }}
          />
        </div>
        <TouchControls
          onPress={(code) => engineRef.current?.pressKey(code)}
          onRelease={(code) => engineRef.current?.releaseKey(code)}
          directions={{
            left: "ArrowLeft",
            right: "ArrowRight",
            up: "ArrowUp",
            down: "ArrowDown",
          }}
          actionCode="Space"
          actionLabel="CAER"
        />
      </div>
    );
  },
);
