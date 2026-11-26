// Lobby screen settings: what each hotel's TV (/tv) shows.
// Stored in public.hotel_screen_settings, one row per hotel
// (Lovable prompts/LOVABLE-lobby-screen-settings.md). Logos and photos live in
// the public "hotel-branding" bucket under <hotel_id>/.
import {
  DEMO_FEATURES,
  DEMO_INFO,
  DEMO_NOTICES,
  DEMO_TAXIS,
  DEMO_TIMETABLE,
  DEMO_TRAINS,
  type FeaturePage,
  type InfoPage,
  type Notice,
  type TimetableRoute,
} from "./tv-content";

export const BRANDING_BUCKET = "hotel-branding";

export type InfoCard = { id: string; title: string; rows: { label: string; value: string }[]; link: string; show: boolean };
export type FeatureCard = { id: string; eyebrow: string; title: string; when: string; body: string; link: string; photo_path: string | null; show: boolean };
export type NoticeItem = { id: string; tag: string; text: string; show: boolean };
export type BusRoute = { id: string; route: string; to: string; times: string[] };
export type TrainLine = { id: string; to: string; times: string[] };
export type Taxi = { id: string; name: string; note: string; phone: string };
export type BusStop = { code: string; name: string };
/** Filled in daily from the Bus Open Data Service (scripts/bods_timetables.py). */
export type AutoTimetable = {
  generated_at: string;
  stops: BusStop[];
  days: { date: string; routes: { route: string; to: string; times: string[] }[] }[];
  error: string | null;
};

export type ScreenSettings = {
  hotel_id: string;
  welcome: string;
  logo_path: string | null;
  photo_path: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  road_radius_miles: number;
  bus_stops: BusStop[];
  rail_station: string | null;
  bus_timetable: BusRoute[];
  trains: TrainLine[];
  taxis: Taxi[];
  info_cards: InfoCard[];
  features: FeatureCard[];
  notices: NoticeItem[];
  /** Read only: written by the daily timetable job, never saved from the page. */
  bus_timetable_auto: AutoTimetable | null;
};

export const newId = () => Math.random().toString(36).slice(2, 10);

/** A new hotel starts with the usual cards filled in as examples to edit. */
export function defaultSettings(hotelId: string): ScreenSettings {
  return {
    hotel_id: hotelId,
    welcome: "Welcome, we're glad you're here",
    logo_path: null,
    photo_path: null,
    postcode: null,
    latitude: null,
    longitude: null,
    road_radius_miles: 10,
    bus_stops: [],
    rail_station: null,
    bus_timetable: [],
    trains: [],
    taxis: [],
    info_cards: [
      { id: newId(), title: "Guest Wi-Fi", rows: [{ label: "Network", value: "" }, { label: "Password", value: "" }], link: "", show: true },
      { id: newId(), title: "Checking in and out", rows: [{ label: "Check-in", value: "From 3pm" }, { label: "Checkout", value: "By 11am" }, { label: "Late checkout", value: "Ask at reception" }], link: "", show: true },
      { id: newId(), title: "Dining today", rows: [{ label: "Breakfast", value: "7 to 10am" }, { label: "Lunch", value: "12 to 2:30pm" }, { label: "Dinner", value: "6:30 to 9pm" }], link: "", show: true },
      { id: newId(), title: "Today's special", rows: [{ label: "Dish", value: "" }, { label: "Price", value: "" }], link: "", show: false },
      { id: newId(), title: "Offers for guests", rows: [{ label: "Next stay", value: "Book direct for our best rate" }], link: "", show: false },
    ],
    features: [],
    notices: [],
    bus_timetable_auto: null,
  };
}

const arr = <T,>(v: unknown, map: (x: Record<string, unknown>) => T): T[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x === "object").map((x) => map(x as Record<string, unknown>)) : [];
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const times = (v: unknown) => (Array.isArray(v) ? v.filter((t): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t)).sort() : []);

/** Database row (or nothing yet) → settings, tolerating missing or odd values. */
export function normalizeSettings(hotelId: string, row: Record<string, unknown> | null | undefined): ScreenSettings {
  if (!row) return defaultSettings(hotelId);
  return {
    hotel_id: hotelId,
    welcome: str(row.welcome),
    logo_path: strOrNull(row.logo_path),
    photo_path: strOrNull(row.photo_path),
    postcode: strOrNull(row.postcode),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    road_radius_miles: num(row.road_radius_miles) ?? 10,
    bus_stops: arr(row.bus_stops, (x) => ({ code: str(x.code), name: str(x.name) })),
    rail_station: strOrNull(row.rail_station),
    bus_timetable: arr(row.bus_timetable, (x) => ({ id: str(x.id) || newId(), route: str(x.route), to: str(x.to), times: times(x.times) })),
    trains: arr(row.trains, (x) => ({ id: str(x.id) || newId(), to: str(x.to), times: times(x.times) })),
    taxis: arr(row.taxis, (x) => ({ id: str(x.id) || newId(), name: str(x.name), note: str(x.note), phone: str(x.phone) })),
    info_cards: arr(row.info_cards, (x) => ({
      id: str(x.id) || newId(),
      title: str(x.title),
      rows: arr(x.rows, (r) => ({ label: str(r.label), value: str(r.value) })),
      link: str(x.link),
      show: x.show !== false,
    })),
    features: arr(row.features, (x) => ({
      id: str(x.id) || newId(),
      eyebrow: str(x.eyebrow),
      title: str(x.title),
      when: str(x.when),
      body: str(x.body),
      link: str(x.link),
      photo_path: strOrNull(x.photo_path),
      show: x.show !== false,
    })),
    notices: arr(row.notices, (x) => ({ id: str(x.id) || newId(), tag: str(x.tag), text: str(x.text), show: x.show !== false })),
    bus_timetable_auto: normalizeAuto(row.bus_timetable_auto),
  };
}

function normalizeAuto(v: unknown): AutoTimetable | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    generated_at: str(o.generated_at),
    stops: arr(o.stops, (x) => ({ code: str(x.code), name: str(x.name) })),
    days: arr(o.days, (d) => ({
      date: str(d.date),
      routes: arr(d.routes, (r) => ({ route: str(r.route), to: str(r.to), times: times(r.times) })),
    })),
    error: typeof o.error === "string" ? o.error : null,
  };
}

/** Today's BODS routes, if the job has run recently enough to cover today. */
export function autoRoutesFor(auto: AutoTimetable | null, isoDate: string) {
  const day = auto?.days.find((d) => d.date === isoDate);
  return day && day.routes.length > 0 ? day.routes : null;
}

/** The settings row as saved from the page: the job's column is left alone. */
export function savable(s: ScreenSettings): Omit<ScreenSettings, "bus_timetable_auto"> {
  const { bus_timetable_auto: _auto, ...rest } = s;
  return rest;
}

export function localIsoDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "07:46, 8:46 9.46" → ["07:46", "08:46", "09:46"]; anything that isn't a time is dropped. */
export function parseTimes(text: string): string[] {
  const out = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(part.trim());
    if (!m) continue;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) continue;
    out.add(`${String(h).padStart(2, "0")}:${m[2]}`);
  }
  return [...out].sort();
}

export type PlayerContent = {
  hotelName: string;
  initials: string;
  welcome: string;
  logoUrl: string | null;
  photoUrl: string | null;
  latitude: number;
  longitude: number;
  features: (FeaturePage & { photoUrl: string | null })[];
  info: InfoPage[];
  timetable: TimetableRoute[];
  /** "Mickleton, Village Hall" when the times come from BODS. */
  timetableFrom: string | null;
  trains: { to: string; times: string[] }[];
  taxis: typeof DEMO_TAXIS;
  notices: Notice[];
  demo: boolean;
};

export function initialsOf(name: string): string {
  const all = name.replace(/\(.*?\)/g, "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  const main = all.filter((w) => !/^(the|and|of|hotel)$/i.test(w));
  const words = main.length >= 2 ? main : all;
  return (words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || name.slice(0, 2).toUpperCase());
}

const hasText = (s: string) => s.trim().length > 0;

/** What the TV shows for a hotel: only filled-in, switched-on items. */
export function playerContent(s: ScreenSettings, hotelName: string, imageUrl: (path: string) => string | null, today = localIsoDate()): PlayerContent {
  // BODS times win once the daily job has run; typed times are the fallback.
  const auto = autoRoutesFor(s.bus_timetable_auto, today);
  const stopNames = (s.bus_timetable_auto?.stops ?? []).map((x) => x.name).filter(hasText);
  const info = s.info_cards
    .filter((c) => c.show && hasText(c.title))
    .map((c) => ({ title: c.title, qr: hasText(c.link) ? "Scan for more" : "", rows: c.rows.filter((r) => hasText(r.value)) }))
    .filter((c) => c.rows.length > 0);
  const features = s.features
    .filter((f) => f.show && hasText(f.title))
    .map((f) => ({ eyebrow: f.eyebrow, title: f.title, when: f.when, body: f.body, qr: hasText(f.link) ? "Scan for details" : "", photoUrl: f.photo_path ? imageUrl(f.photo_path) : null }));
  const taxis = s.taxis.filter((t) => hasText(t.name));
  return {
    hotelName,
    initials: initialsOf(hotelName),
    welcome: s.welcome,
    logoUrl: s.logo_path ? imageUrl(s.logo_path) : null,
    photoUrl: s.photo_path ? imageUrl(s.photo_path) : null,
    latitude: s.latitude ?? 52.09,
    longitude: s.longitude ?? -1.77,
    features,
    info,
    timetable: auto
      ? auto.map((r) => ({ route: r.route, to: r.to, times: r.times }))
      : s.bus_timetable.filter((r) => hasText(r.route) && r.times.length > 0).map((r) => ({ route: r.route, to: r.to, times: r.times })),
    timetableFrom: auto && stopNames.length > 0 ? [...new Set(stopNames)].join(" and ") : null,
    trains: s.trains.filter((t) => hasText(t.to) && t.times.length > 0).map((t) => ({ to: t.to, times: t.times })),
    taxis: {
      title: "Local taxis",
      note: "Reception can book one for you",
      rows: taxis.map((t) => ({ badge: "Taxi", kind: "taxi" as const, to: hasText(t.note) ? `${t.name}, ${t.note}` : t.name, time: t.phone })),
    },
    notices: s.notices.filter((n) => n.show && hasText(n.text)).map((n) => ({ tag: n.tag || "Notice", text: n.text })),
    demo: false,
  };
}

export const DEMO_PLAYER: PlayerContent = {
  hotelName: "Development Hotel",
  initials: "DH",
  welcome: "Welcome, we're glad you're here",
  logoUrl: null,
  photoUrl: null,
  latitude: 52.09,
  longitude: -1.77,
  features: DEMO_FEATURES.map((f) => ({ ...f, photoUrl: null })),
  info: DEMO_INFO,
  timetable: DEMO_TIMETABLE,
  timetableFrom: null,
  trains: DEMO_TRAINS,
  taxis: DEMO_TAXIS,
  notices: DEMO_NOTICES,
  demo: true,
};
