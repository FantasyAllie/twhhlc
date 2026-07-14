import { useEffect, useMemo, useState } from "react";

export function BroomBurst({
  active,
  count = 40,
  durationMs = 4000,
  onDone,
}: {
  active: boolean;
  count?: number;
  durationMs?: number;
  onDone?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [active, durationMs, onDone]);

  const pieces = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 400,
      rotate: Math.floor(Math.random() * 720) - 360,
      size: 24 + Math.random() * 40,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, count]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute animate-fade-in"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            fontSize: `${p.size}px`,
            transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}ms`,
            animationDuration: "600ms",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
          }}
        >
          🧹
        </span>
      ))}
    </div>
  );
}