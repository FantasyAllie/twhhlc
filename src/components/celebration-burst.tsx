// Full-screen celebration shown when the room progress bar reaches 100%:
// animated fireworks behind a "Congratulations" banner. Purely decorative —
// no pointer events, and nothing is left on screen once it finishes.
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
  trail: number;
};

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
    return Array.from({ length: 26 }).map((_, i) => ({
      id: i,
      left: 6 + Math.random() * 88,
      top: 8 + Math.random() * 60,
      delay: Math.random() * 4200,
      duration: 1000 + Math.random() * 700,
      size: 110 + Math.random() * 180,
      hue: Math.floor(Math.random() * 360),
      sparks: 14 + Math.floor(Math.random() * 8),
      trail: 300 + Math.random() * 260,
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
          6%, 12% { opacity: 0.9; }
          38%, 44% { opacity: 0.7; }
          66%, 72% { opacity: 0.5; }
        }
        @keyframes cb-launch {
          0% { transform: translateY(0) scaleY(1); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(calc(var(--cb-trail) * -1)) scaleY(0.4); opacity: 0; }
        }
        @keyframes cb-shell {
          0% { transform: scale(0.15); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes cb-spark {
          0% { transform: rotate(var(--cb-angle)) translateY(0) scale(1.2); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: rotate(var(--cb-angle)) translateY(calc(var(--cb-dist) * -1)) scale(0.15); opacity: 0; }
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

      {/* Night-sky flashes from the bursts (starts and ends fully transparent) */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-amber-300/20 via-transparent to-fuchsia-400/20"
        style={{ opacity: 0, animation: "cb-flash 5.6s ease-in-out forwards" }}
      />

      {/* Firework rockets and bursts */}
      {fireworks.map((f) => (
        <div key={`fw-${f.id}`}>
          {/* rocket trail rising to the burst point */}
          <span
            className="absolute block w-[3px] rounded-full"
            style={
              {
                left: `${f.left}%`,
                top: `${f.top}%`,
                height: `${f.trail * 0.18}px`,
                background: `linear-gradient(to top, transparent, hsl(${f.hue} 95% 70%))`,
                boxShadow: `0 0 8px 2px hsl(${f.hue} 95% 70% / 0.6)`,
                transformOrigin: "bottom center",
                "--cb-trail": `${f.trail}px`,
                animation: `cb-launch 700ms ease-out ${Math.max(f.delay - 650, 0)}ms both`,
              } as React.CSSProperties
            }
          />
          <div
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
                    background: `hsl(${(f.hue + s * 10) % 360} 95% 64%)`,
                    boxShadow: `0 0 12px 3px hsl(${(f.hue + s * 10) % 360} 95% 64% / 0.85)`,
                    "--cb-angle": `${(360 / f.sparks) * s}deg`,
                    "--cb-dist": `${f.size / 2}px`,
                    animation: `cb-spark ${f.duration}ms ease-out ${f.delay}ms both`,
                  } as React.CSSProperties
                }
              />
            ))}
            {/* inner ring of smaller sparks for a fuller burst */}
            {Array.from({ length: f.sparks }).map((_, s) => (
              <span
                key={`i-${s}`}
                className="absolute left-1/2 top-1/2 block h-1 w-1 rounded-full"
                style={
                  {
                    background: `hsl(${(f.hue + 40 + s * 10) % 360} 95% 72%)`,
                    "--cb-angle": `${(360 / f.sparks) * s + 12}deg`,
                    "--cb-dist": `${f.size / 3.2}px`,
                    animation: `cb-spark ${f.duration * 0.85}ms ease-out ${f.delay + 60}ms both`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      ))}

      {/* Congratulations banner */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ animation: "cb-banner 5.5s cubic-bezier(0.22,1,0.36,1) 250ms both" }}
      >
        <div className="relative overflow-hidden rounded-2xl border-2 border-white/30 bg-gradient-to-br from-primary to-fuchsia-600 px-8 py-5 shadow-2xl">
          <div className="relative z-10 text-center">
            <div className="text-4xl">🎆🎇</div>
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
