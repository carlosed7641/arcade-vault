"use client";

import {
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type DirectionKey = "up" | "down" | "left" | "right";

export type TouchControlsProps = {
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
  /** Solo se renderizan los botones de dirección presentes en el mapa. */
  directions: Partial<Record<DirectionKey, string>>;
  actionCode: string;
  actionLabel: string;
};

const DIRECTION_LABELS: Record<DirectionKey, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};

// Simula el auto-repeat nativo del teclado (OS key-repeat) para que sostener un botón
// táctil dispare la misma acción repetidamente, igual que sostener la tecla física.
const REPEAT_DELAY_MS = 300;
const REPEAT_INTERVAL_MS = 60;

function useHoldButton(
  code: string,
  onPress: (code: string) => void,
  onRelease: (code: string) => void,
) {
  const pointerIdRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  function clearTimers() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function handlePress(e: ReactPointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== null) return;
    e.preventDefault();
    pointerIdRef.current = e.pointerId;
    // setPointerCapture puede lanzar (p. ej. NotFoundError si el pointer ya no está
    // activo); es solo una mejora para seguir recibiendo el pointerup si el dedo se
    // desliza fuera del botón, no debe bloquear la acción real del juego.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // no-op: seguimos dependiendo de pointerup/pointercancel/pointerleave/pointerout.
    }
    onPress(code);
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(
        () => onPress(code),
        REPEAT_INTERVAL_MS,
      );
    }, REPEAT_DELAY_MS);
  }

  function handleRelease(e: ReactPointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    clearTimers();
    onRelease(code);
  }

  return {
    onPointerDown: handlePress,
    onPointerUp: handleRelease,
    onPointerCancel: handleRelease,
    onPointerLeave: handleRelease,
    onPointerOut: handleRelease,
    onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) =>
      e.preventDefault(),
  };
}

function TouchButton({
  code,
  label,
  className,
  onPress,
  onRelease,
}: {
  code: string;
  label: string;
  className: string;
  onPress: (code: string) => void;
  onRelease: (code: string) => void;
}) {
  const handlers = useHoldButton(code, onPress, onRelease);
  return (
    <button
      type="button"
      aria-label={label}
      className={className}
      {...handlers}
    >
      {label}
    </button>
  );
}

export function TouchControls({
  onPress,
  onRelease,
  directions,
  actionCode,
  actionLabel,
}: TouchControlsProps) {
  const directionEntries = Object.entries(directions) as [
    DirectionKey,
    string,
  ][];

  return (
    <div className="touch-controls">
      <div className="touch-dpad">
        {directionEntries.map(([dir, code]) => (
          <TouchButton
            key={dir}
            code={code}
            label={DIRECTION_LABELS[dir]}
            className={`touch-dpad-btn ${dir}`}
            onPress={onPress}
            onRelease={onRelease}
          />
        ))}
      </div>
      <TouchButton
        code={actionCode}
        label={actionLabel}
        className="touch-action-btn"
        onPress={onPress}
        onRelease={onRelease}
      />
    </div>
  );
}
