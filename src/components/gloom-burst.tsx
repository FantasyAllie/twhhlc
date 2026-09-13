// Full-screen "shift finished but rooms were left dirty" outcome: drooping grey
// rain and a deflated banner with a sad trombone. Purely decorative — no pointer
// events, and nothing is left on screen once it finishes.
import { useEffect, useMemo, useRef, useState } from "react";
import sadTromboneAsset from "@/assets/sad-trombone.mp3.asset.json";

type Drop = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  length: number;
  opacity: number;
};

export function GloomBurst({
  active,
  durationMs = 5200,
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

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!running) {
      audioRef.current?.pause();
      return;
    }
    const audio = new Audio(sadTromboneAsset.url);
    audio.volume = 0.85;
    audioRef.current = audio;
    const play = audio.play();
    if (play !== undefined) {
      play.catch(() => {
        // Autoplay policy or other playback failure — ignore silently.
      });
    }
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [running]);

  const drops = useMemo<Drop[]>(() => {
    if (!running) return [];
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 3200,
      duration: 1400 + Math.random() * 1200,
      length: 40 + Math.random() * 70,
      opacity: 0.25 + Math.random() * 0.35,
    }));
  }, [running]);

  if (!running) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      <style>{`
        @keyframes gb-dim {
          0%, 100% { opacity: 0; }
          14%, 78% { opacity: 1; }
        }
        @keyframes gb-rain {
          0% { transform: translateY(-20vh); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translateY(120vh); opacity: 0; }
        }
        @keyframes gb-banner {
          0% { transform: translate(-50%, -70%) scale(0.85) rotate(-2deg); opacity: 0; }
          18% { transform: translate(-50%, -50%) scale(1) rotate(1deg); opacity: 1; }
          34% { transform: translate(-50%, -48%) scale(0.99) rotate(-1deg); opacity: 1; }
          82% { transform: translate(-50%, -46%) scale(0.98) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, -30%) scale(0.9) rotate(0deg); opacity: 0; }
        }
        @keyframes gb-droop {
          0%, 100% { transform: rotate(-6deg) translateY(0); }
          50% { transform: rotate(6deg) translateY(4px); }
        }
      `}</style>

      {/* Grey overcast wash (starts and ends fully transparent) */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-900/45 via-slate-800/25 to-slate-900/45"
        style={{ opacity: 0, animation: "gb-dim 5s ease-in-out forwards" }}
      />

      {/* Drizzle */}
      {drops.map((d) => (
        <span
          key={`gd-${d.id}`}
          className="absolute top-0 block w-[2px] rounded-full bg-slate-300"
          style={{
            left: `${d.left}%`,
            height: `${d.length}px`,
            opacity: d.opacity,
            animation: `gb-rain ${d.duration}ms linear ${d.delay}ms both`,
          }}
        />
      ))}

      {/* Deflated banner */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{ animation: "gb-banner 5s cubic-bezier(0.22,1,0.36,1) 200ms both" }}
      >
        <div className="relative overflow-hidden rounded-2xl border-2 border-white/20 bg-gradient-to-br from-slate-700 to-slate-900 px-8 py-5 shadow-2xl">
          <div className="relative z-10 max-w-[22rem] text-center">
            <div
              className="text-4xl"
              style={{ animation: "gb-droop 2.2s ease-in-out infinite", display: "inline-block" }}
            >
              🎺
            </div>
            <div className="mt-1 text-xl font-black uppercase tracking-wider text-white drop-shadow">
              You haven't finished all the rooms
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-[0.3em] text-white/70">
              Better luck next time
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
