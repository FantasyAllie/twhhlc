// Full-screen celebration shown when the room progress bar reaches 100%:
// fireworks flashes, party poppers and floating balloons behind a
// "Congratulations" banner. Purely decorative — no pointer events.
import { useEffect, useMemo, useState } from "react";

type Firework = {
  id: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
  size: number;
  hue: number;
  sparks: number;
};

type Floater = {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
  size: number;
};

const BALLOONS = ["🎈", "🎈", "🎈", "🎊", "🎉"];
const POPPERS = ["🎉", "🎊", "🥳", "✨", "🎆", "🎇"];

export function CelebrationBurst({
  active,
  durationMs = 6000,
  onDone,
}: {
  active: boolean;
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

  const fireworks = useMemo<Firework[]>(() => {
    if (!running) return [];
    return Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      left: 8 + Math.random() * 84,
      top: 8 + Math.random() * 55,
      delay: Math.random() * 3200,
      duration: 900 + Math.random() * 600,
      size: 90 + Math.random() * 130,
      hue: Math.floor(Math.random() * 360),
      sparks: 12,
    }));
  }, [running]);

  const balloons = useMemo<Floater[]>(() => {
    if (!running) return [];
    return Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      emoji: BALLOONS[i % BALLOONS.length],
      left: Math.random() * 100,
      delay: Math.random() * 2200,
      duration: 3600 + Math.random() * 2200,
      drift: (Math.random() - 0.5) * 160,
      rotate: Math.floor(Math.random() * 60) - 30,
      size: 26 + Math.random() * 30,
    }));
  }, [running]);

  const poppers = useMemo<Floater[]>(() => {
    if (!running) return [];
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      emoji: POPPERS[i % POPPERS.length],
      left: Math.random() * 100,
      delay: Math.random() * 2600,
      duration: 1400 + Math.random() * 1400,
      drift: (Math.random() - 0.5) * 320,
      rotate: Math.floor(Math.random() * 720) - 360,
      size: 20 + Math.random() * 24,
    }));
  }, [running]);

  if (!running) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      <style>{`
        @keyframes cb-flash {
          0%, 100% { opacity: 0; }
          6%, 14% { opacity: 1; }
          40%, 48% { opacity: 0.8; }
          70%, 78% { opacity: 0.6; }
        }
        @keyframes cb-shell {
          0% { transform: scale(0.2); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes cb-spark {
          0% { transform: rotate(var(--cb-angle)) translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: rotate(var(--cb-angle)) translateY(calc(var(--cb-dist) * -1)) scale(0.2); opacity: 0; }
        }
        @keyframes cb-float {
          0% { transform: translate(-50%, 20vh) rotate(0deg); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--cb-drift)), -110vh) rotate(var(--cb-rotate)); opacity: 0; }
        }
        @keyframes cb-pop {
          0% { transform: translate(-50%, 10vh) rotate(0deg) scale(0.3); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--cb-drift)), -80vh) rotate(var(--cb-rotate)) scale(1); opacity: 0; }
        }
        @keyframes cb-banner {
          0% { transform: translate(-50%, -50%) scale(0.4) rotate(-6deg); opacity: 0; }
          20% { transform: translate(-50%, -50%) scale(1.12) rotate(2deg); opacity: 1; }
          40% { transform: translate(-50%, -50%) scale(1) rotate(-1deg); opacity: 1; }
          88% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.18) rotate(0deg); opacity: 0; }
        }
        @keyframes cb-shine {
          0% { transform: translateX(-100%) skewX(-20deg); }
          100% { transform: translateX(200%) skewX(-20deg); }
        }
      `}</style>

      {/* Fireworks flashes lighting the screen */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-amber-300/25 via-transparent to-fuchsia-400/25"
        style={{ animation: "cb-flash 5.5s ease-in-out" }}
      />

      {/* Firework bursts */}
      {fireworks.map((f) => (
        <div
          key={`fw-${f.id}`}
          className="absolute"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: f.size,
            height: f.size,
            marginLeft: -f.size / 2,
            marginTop: -f.size / 2,
            animation: `cb-shell ${f.duration}ms ease-out ${f.delay}ms both`,
          }}
        >
          {Array.from({ length: f.sparks }).map((_, s) => (
            <span
              key={s}
              className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 rounded-full"
              style={
                {
                  background: `hsl(${(f.hue + s * 12) % 360} 95% 62%)`,
                  boxShadow: `0 0 10px 2px hsl(${(f.hue + s * 12) % 360} 95% 62% / 0.8)`,
                  "--cb-angle": `${(360 / f.sparks) * s}deg`,
                  "--cb-dist": `${f.size / 2}px`,
                  animation: `cb-spark ${f.duration}ms ease-out ${f.delay}ms both`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ))}

      {/* Balloons rising */}
      {balloons.map((b) => (
        <span
          key={`bl-${b.id}`}
          className="absolute bottom-0"
          style={
            {
              left: `${b.left}%`,
              fontSize: `${b.size}px`,
              "--cb-drift": `${b.drift}px`,
              "--cb-rotate": `${b.rotate}deg`,
              animation: `cb-float ${b.duration}ms cubic-bezier(0.33,0.9,0.4,1) ${b.delay}ms both`,
              filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.22))",
            } as React.CSSProperties
          }
        >
          {b.emoji}
        </span>
      ))}

      {/* Party poppers */}
      {poppers.map((p) => (
        <span
          key={`pp-${p.id}`}
          className="absolute bottom-0"
          style={
            {
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              "--cb-drift": `${p.drift}px`,
              "--cb-rotate": `${p.rotate}deg`,
              animation: `cb-pop ${p.duration}ms cubic-bezier(0.22,1,0.36,1) ${p.delay}ms both`,
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))",
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}

      {/* Congratulations banner */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ animation: "cb-banner 5.5s cubic-bezier(0.22,1,0.36,1) 250ms both" }}
      >
        <div className="relative overflow-hidden rounded-2xl border-2 border-white/30 bg-gradient-to-br from-primary to-fuchsia-600 px-8 py-5 shadow-2xl">
          <div className="relative z-10 text-center">
            <div className="text-4xl">🎉🎆🎈</div>
            <div className="mt-1 text-3xl font-black uppercase tracking-widest text-white drop-shadow">
              Congratulations
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.3em] text-white/80">
              All rooms complete
            </div>
          </div>
          <div
            className="absolute inset-y-0 left-0 w-1/3 bg-white/25"
            style={{ animation: "cb-shine 1.4s ease-in-out 450ms 2 both" }}
          />
        </div>
      </div>
    </div>
  );
}
