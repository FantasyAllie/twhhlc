import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import tvCss from "../tv.css?url";
import tvBackground from "@/assets/tv-background.jpg";
import {
  BURN_IN_OFFSETS,
  DEMO_FEATURES,
  DEMO_HOTEL,
  DEMO_INFO,
  DEMO_NOTICES,
  DEMO_TAXIS,
  DEMO_TIMETABLE,
  nextDepartures,
  timetableWindow,
  weatherIcon,
  weatherLabel,
  type WeatherIcon,
} from "@/lib/tv-content";

// Lobby TV player, demo version: made-up content and live demo weather.
// No sign-in and no database. Pairing and real content come after the
// move off Lovable (see Plans/LOBBY-SCREENS-and-app-split.md).
export const Route = createFileRoute("/tv")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lobby screen — Tsuyu" },
      { name: "robots", content: "noindex" },
    ],
    links: [
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&display=swap" },
      { rel: "stylesheet", href: tvCss },
    ],
  }),
  component: LobbyScreen,
});

const STAGE_W = 1920;
const STAGE_H = 1080;

type Weather = {
  temp: number;
  code: number;
  days: { name: string; high: number }[];
  updatedAt: Date;
};

function useNow(everyMs = 10_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** Page index plus a short fade-out before each change. */
function useRotator(length: number, everyMs: number) {
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let swap: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setVisible(false);
      swap = setTimeout(() => {
        setPage((p) => (p + 1) % length);
        setVisible(true);
      }, 450);
    }, everyMs);
    return () => {
      clearInterval(id);
      if (swap) clearTimeout(swap);
    };
  }, [length, everyMs]);
  return { page: page % length, opacity: visible ? 1 : 0 };
}

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

function useBurnInOffset(everyMs = 3 * 60_000) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % BURN_IN_OFFSETS.length), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return BURN_IN_OFFSETS[i];
}

const WEATHER_CACHE_KEY = "tv-demo-weather";

function useDemoWeather() {
  const [weather, setWeather] = useState<Weather | null>(() => {
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (!raw) return null;
      const w = JSON.parse(raw);
      return { ...w, updatedAt: new Date(w.updatedAt) };
    } catch {
      return null;
    }
  });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${DEMO_HOTEL.latitude}&longitude=${DEMO_HOTEL.longitude}` +
          "&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max&timezone=Europe%2FLondon&forecast_days=4";
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const days = (data.daily.time as string[]).slice(1, 4).map((iso, i) => ({
          name: new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" }),
          high: Math.round(data.daily.temperature_2m_max[i + 1]),
        }));
        const next: Weather = {
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
          days,
          updatedAt: new Date(),
        };
        if (cancelled) return;
        setWeather(next);
        try {
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(next));
        } catch {
          /* storage off: carry on without the offline copy */
        }
      } catch {
        /* offline: keep showing the last copy */
      }
    };
    void load();
    const id = setInterval(load, 15 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return weather;
}

function LobbyScreen() {
  const now = useNow();
  const scale = useStageScale();
  const [dx, dy] = useBurnInOffset();
  const weather = useDemoWeather();
  const feature = useRotator(DEMO_FEATURES.length, 12_000);
  const travel = useRotator(2, 9_000);
  const info = useRotator(DEMO_INFO.length, 7_000);
  const notice = useRotator(DEMO_NOTICES.length, 8_000);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const travelPage = travel.page === 0 ? nextDepartures(nowMinutes) : DEMO_TAXIS;
  const featurePage = DEMO_FEATURES[feature.page];
  const infoPage = DEMO_INFO[info.page];
  const noticePage = DEMO_NOTICES[notice.page];

  return (
    <div className="tv-viewport">
      <div
        className="tv-stage"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <img className="tv-bg" src={tvBackground} alt="" />
        <div className="tv-dim" />

        <div className="tv-frame tv-col" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
          <header className="tv-top tv-glass">
            <div className="tv-brand">
              <div className="tv-badge tv-serif">{DEMO_HOTEL.initials}</div>
              <div>
                <span className="tv-hotel-name tv-serif">{DEMO_HOTEL.name}</span>
                <span className="tv-welcome tv-muted">{DEMO_HOTEL.welcome}</span>
              </div>
            </div>
            <div className="tv-clock">
              <span className="tv-clock-time tv-nums">{time}</span>
              <span className="tv-clock-date tv-muted">{date}</span>
            </div>
            <div className="tv-weather">
              <div className="tv-weather-now">
                <WeatherGlyph icon={weather ? weatherIcon(weather.code) : "cloud"} />
                <div>
                  <span className="tv-temp">{weather ? `${weather.temp}°` : "–"}</span>
                  <span className="tv-sky tv-muted">{weather ? weatherLabel(weather.code) : "Weather loading"}</span>
                </div>
              </div>
              <div className="tv-forecast">
                {(weather?.days ?? []).map((d) => (
                  <div key={d.name} className="tv-day">
                    <span className="tv-day-name">{d.name}</span>
                    <span className="tv-day-high">{d.high}°</span>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <div className="tv-middle tv-row">
            <div className="tv-left tv-col">
              <section className="tv-feature tv-glass">
                <div className="tv-feature-inner tv-fade" style={{ opacity: feature.opacity }}>
                  <img className="tv-feature-photo" src={tvBackground} alt="" />
                  <div className="tv-feature-text">
                    <span className="tv-feature-eyebrow tv-eyebrow">{featurePage.eyebrow}</span>
                    <h1 className="tv-feature-title tv-serif">{featurePage.title}</h1>
                    {featurePage.when && <span className="tv-when">{featurePage.when}</span>}
                    <p className="tv-feature-body">{featurePage.body}</p>
                    <Dots count={DEMO_FEATURES.length} on={feature.page} />
                  </div>
                  <QrBlock size={110} label={featurePage.qr} />
                </div>
              </section>

              <section className="tv-card tv-glass">
                <div className="tv-card-head">
                  <h2 className="tv-card-title tv-serif">Bus timetable</h2>
                  <span className="tv-card-sub">From the village stop · today · next bus in gold</span>
                </div>
                {DEMO_TIMETABLE.map((r) => (
                  <div key={`${r.route}-${r.to}`} className="tv-line">
                    <span className="tv-pill bus">{r.route}</span>
                    <span className="tv-timetable-to">{r.to}</span>
                    <div className="tv-times">
                      {timetableWindow(r.times, nowMinutes).map((t) => (
                        <span key={t.at} className={`tv-time tv-nums ${t.state}`}>{t.at}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </div>

            <div className="tv-right tv-col">
              <section className="tv-card tv-glass">
                <div className="tv-fade" style={{ opacity: travel.opacity }}>
                  <h2 className="tv-card-title tv-serif">{travelPage.title}</h2>
                  {travelPage.rows.map((row, i) => (
                    <div key={i} className="tv-line">
                      <span className={`tv-pill ${row.kind}`}>{row.badge}</span>
                      <span className="tv-line-to">{row.to}</span>
                      <span className="tv-line-time tv-nums">{row.time}</span>
                    </div>
                  ))}
                  <div className="tv-card-note">{travelPage.note}</div>
                </div>
                <Dots count={2} on={travel.page} />
              </section>

              <section className="tv-info tv-glass">
                <div className="tv-info-body tv-fade" style={{ opacity: info.opacity }}>
                  <span className="tv-info-eyebrow tv-eyebrow">At the hotel</span>
                  <h2 className="tv-card-title tv-serif">{infoPage.title}</h2>
                  <div className="tv-info-rows">
                    <div className="tv-info-list">
                      {infoPage.rows.map((row) => (
                        <div key={row.label} className="tv-info-row">
                          <span className="tv-info-label">{row.label}</span>
                          <span className="tv-info-value">{row.value}</span>
                        </div>
                      ))}
                    </div>
                    {infoPage.qr && <QrBlock size={104} label={infoPage.qr} />}
                  </div>
                </div>
                <Dots count={DEMO_INFO.length} on={info.page} />
              </section>
            </div>
          </div>

          <footer className="tv-bottom tv-glass">
            <div className="tv-fade" style={{ opacity: notice.opacity, display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <span className="tv-tag">{noticePage.tag}</span>
              <span className="tv-notice">{noticePage.text}</span>
            </div>
            <Dots count={DEMO_NOTICES.length} on={notice.page} />
          </footer>
        </div>

        <span className="tv-demo">Demo content</span>
        {weather && (
          <span className="tv-updated">
            Weather updated {weather.updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}

function Dots({ count, on }: { count: number; on: number }) {
  return (
    <div className="tv-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`tv-dot${i === on ? " is-on" : ""}`} />
      ))}
    </div>
  );
}

function QrBlock({ size, label }: { size: number; label: string }) {
  const icon = Math.round(size * 0.72);
  return (
    <div className="tv-qr">
      <div className="tv-qr-box" style={{ width: size, height: size }}>
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="#1d1a17" strokeWidth="1.6" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2" />
        </svg>
      </div>
      <span className="tv-qr-label">{label}</span>
    </div>
  );
}

function WeatherGlyph({ icon }: { icon: WeatherIcon }) {
  const common = { width: 52, height: 52, viewBox: "0 0 24 24", fill: "none", stroke: "#ffffff", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const cloud = <path d="M7 16a4 4 0 0 1-.9-7.9A5.5 5.5 0 0 1 16.8 7 4.5 4.5 0 0 1 17 16z" />;
  switch (icon) {
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "partly":
      return (
        <svg {...common}>
          <path d="M8 6.5A3.5 3.5 0 0 1 14 5M5 9h1M7 3.5l.7.7" />
          <path d="M8 19a4 4 0 0 1-.4-8 5 5 0 0 1 9.6-.5A3.8 3.8 0 0 1 17 19z" />
        </svg>
      );
    case "cloud":
      return <svg {...common}>{cloud}</svg>;
    case "fog":
      return (
        <svg {...common}>
          {cloud}
          <path d="M5 19h14M7 22h10" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common}>
          {cloud}
          <path d="M9 19h.01M13 19h.01M17 19h.01M11 21.5h.01M15 21.5h.01" />
        </svg>
      );
    case "storm":
      return (
        <svg {...common}>
          {cloud}
          <path d="M12 16l-2 4h4l-2 3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          {cloud}
          <path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2" />
        </svg>
      );
  }
}
