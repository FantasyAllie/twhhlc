import { useEffect, useMemo, useState } from "react";

type Piece = {
  id: number;
  emoji: string;
  left: number;
  top: number;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
  rise: number;
  size: number;
  anim: "rise" | "swirl" | "pop";
};

type Sweeper = {
  id: number;
  top: number;
  delay: number;
  duration: number;
  direction: 1 | -1;
  size: number;
};

const CONFETTI_EMOJI = ["🧹", "✨", "🫧", "🧼", "💫", "💨", "⭐️"];

export function BroomBurst({
  active,
  count = 55,
  durationMs = 4000,
  onDone,
}: {
  active: boolean;
  count?: number;
  durationMs?: number;
  onDone?: () => void;
}) {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!active) return;
    setRunning(true);
    const t = window.setTimeout(() => {
      setRunning(false);
      onDone?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [active, durationMs, onDone]);

  const pieces = useMemo<Piece[]>(() => {
    if (!running) return [];
    return Array.from({ length: count }).map((_, i) => {
      const anim =
        i % 5 === 0 ? "pop" : i % 3 === 0 ? "swirl" : "rise";
      return {
        id: i,
        emoji: CONFETTI_EMOJI[i % CONFETTI_EMOJI.length],
        left: Math.random() * 100,
        top: 60 + Math.random() * 50,
        delay: Math.random() * 700,
        duration: 1600 + Math.random() * 1600,
        rotate: Math.floor(Math.random() * 900) - 450,
        drift: (Math.random() - 0.5) * 260,
        rise: 260 + Math.random() * 420,
        size: 22 + Math.random() * 28,
        anim,
      };
    });
  }, [running, count]);

  const sweepers = useMemo<Sweeper[]>(() => {
    if (!running) return [];
    return Array.from({ length: 4 }).map((_, i) => ({
      id: i,
      top: 15 + i * 20 + Math.random() * 5,
      delay: i * 180,
      duration: 1400 + Math.random() * 400,
      direction: i % 2 === 0 ? 1 : -1,
      size: 44 + Math.random() * 20,
    }));
  }, [running]);

  if (!running) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      <style>{`
        @keyframes bb-rise {
          0% { transform: translate(-50%, 0) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--bb-drift, 0px)), calc(var(--bb-rise, -300px) * -1)) rotate(var(--bb-rotate, 360deg));
            opacity: 0;
          }
        }
        @keyframes bb-swirl {
          0% { transform: translate(-50%, 0) rotate(0deg) scale(0.4); opacity: 0; }
          20% { opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--bb-drift, 0px)), calc(var(--bb-rise, -300px) * -1)) rotate(var(--bb-rotate, 720deg)) scale(1.1);
            opacity: 0;
          }
        }
        @keyframes bb-pop {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          40% { transform: translate(-50%, -50%) scale(1.4); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
        }
        @keyframes bb-sweep-r {
          0% { transform: translate(-20vw, 0) rotate(-25deg); }
          100% { transform: translate(120vw, 0) rotate(15deg); }
        }
        @keyframes bb-sweep-l {
          0% { transform: translate(120vw, 0) rotate(25deg) scaleX(-1); }
          100% { transform: translate(-20vw, 0) rotate(-15deg) scaleX(-1); }
        }
        @keyframes bb-banner {
          0% { transform: translate(-50%, -50%) scale(0.4) rotate(-8deg); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.15) rotate(3deg); opacity: 1; }
          55% { transform: translate(-50%, -50%) scale(1) rotate(-2deg); opacity: 1; }
          85% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.2) rotate(0deg); opacity: 0; }
        }
        @keyframes bb-flash {
          0%, 100% { opacity: 0; }
          10%, 25% { opacity: 1; }
        }
        @keyframes bb-shine {
          0% { transform: translateX(-100%) skewX(-20deg); }
          100% { transform: translateX(200%) skewX(-20deg); }
        }
      `}</style>

      {/* Background flash */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-emerald-400/20"
        style={{ animation: "bb-flash 1.2s ease-out" }}
      />

      {/* Sweeping brooms across the screen */}
      {sweepers.map((s) => (
        <div
          key={`sw-${s.id}`}
          className="absolute"
          style={{
            top: `${s.top}%`,
            left: 0,
            fontSize: `${s.size}px`,
            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.25))",
            animation: `${s.direction === 1 ? "bb-sweep-r" : "bb-sweep-l"} ${s.duration}ms cubic-bezier(0.22,1,0.36,1) ${s.delay}ms both`,
          }}
        >
          🧹
        </div>
      ))}

      {/* Confetti pieces rising / swirling */}
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute"
          style={
            {
              left: `${p.left}%`,
              top: `${p.top}%`,
              fontSize: `${p.size}px`,
              transform: "translate(-50%, 0)",
              "--bb-drift": `${p.drift}px`,
              "--bb-rise": `${p.rise}px`,
              "--bb-rotate": `${p.rotate}deg`,
              animation: `${
                p.anim === "rise"
                  ? "bb-rise"
                  : p.anim === "swirl"
                    ? "bb-swirl"
                    : "bb-pop"
              } ${p.duration}ms cubic-bezier(0.22,1,0.36,1) ${p.delay}ms both`,
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))",
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}

      {/* Center banner */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          animation: "bb-banner 3.6s cubic-bezier(0.22,1,0.36,1) 200ms both",
        }}
      >
        <div className="relative overflow-hidden rounded-2xl border-2 border-white/30 bg-gradient-to-br from-primary to-emerald-500 px-8 py-4 shadow-2xl">
          <div className="relative z-10 text-center">
            <div className="text-4xl">🧹✨</div>
            <div className="mt-1 text-2xl font-black uppercase tracking-widest text-white drop-shadow">
              All Fresh!
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.3em] text-white/80">
              Rooms reset
            </div>
          </div>
          <div
            className="absolute inset-y-0 left-0 w-1/3 bg-white/30"
            style={{
              animation: "bb-shine 1.4s ease-in-out 400ms 2 both",
            }}
          />
        </div>
      </div>
    </div>
  );
}
