"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createEngine, type AsteroidsEngine } from "./engine";
import { SKINS, DEFAULT_SKIN, type Skin } from "../skins";
import { TouchControls } from "../TouchControls";

export type AsteroidsCanvasHandle = {
  restart: () => void;
  setPaused: (paused: boolean) => void;
  forceGameOver: () => void;
};

type AsteroidsCanvasProps = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  skin?: Skin;
};

export const AsteroidsCanvas = forwardRef<
  AsteroidsCanvasHandle,
  AsteroidsCanvasProps
>(function AsteroidsCanvas(
  { onScoreChange, onLivesChange, onLevelChange, onGameOver, skin },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);

  useImperativeHandle(ref, () => ({
    restart: () => engineRef.current?.restart(),
    setPaused: (paused: boolean) => engineRef.current?.setPaused(paused),
    forceGameOver: () => engineRef.current?.forceGameOver(),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createEngine(
      canvas,
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

  // El prop `skin` no recrea el engine — solo reasigna la variable de closure que el
  // draw loop lee cada frame, vía `setSkin`.
  useEffect(() => {
    engineRef.current?.setSkin(skin ?? SKINS[DEFAULT_SKIN]);
  }, [skin]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ display: "block", width: "100%", height: "auto" }}
      />
      <TouchControls
        onPress={(code) => engineRef.current?.pressKey(code)}
        onRelease={(code) => engineRef.current?.releaseKey(code)}
        directions={{ left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp" }}
        actionCode="Space"
        actionLabel="DISPARAR"
      />
    </>
  );
});
