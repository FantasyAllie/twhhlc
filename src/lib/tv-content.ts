// Lobby TV (/tv): demo content and the pure rules the player uses.
// Everything here is made up for testing on real TVs. After the move off
// Lovable this content comes from the Content module tables instead.

export type InfoRow = { label: string; value: string };
export type InfoPage = { title: string; qr: string; rows: InfoRow[] };
export type FeaturePage = { eyebrow: string; title: string; when: string; body: string; qr: string };
export type TravelRow = { badge: string; kind: "bus" | "rail" | "taxi" | "car"; to: string; time: string };
export type TravelPage = { title: string; note: string; rows: TravelRow[] };
export type TimetableRoute = { route: string; to: string; times: string[] };
export type Notice = { tag: string; text: string };

export const DEMO_HOTEL = {
  name: "Development Hotel",
  initials: "DH",
  welcome: "Welcome, we're glad you're here",
  // Mickleton, Gloucestershire: only used to fetch demo weather.
  latitude: 52.09,
  longitude: -1.77,
};

export const DEMO_FEATURES: FeaturePage[] = [
  {
    eyebrow: "Our other hotels",
    title: "Stay with our sister hotel in Bath",
    when: "",
    body: "Two nights, Sunday to Thursday, from [PRICE]. Breakfast included, and a bottle of wine waiting in your room.",
    qr: "Scan to book",
  },
  {
    eyebrow: "What’s on nearby",
    title: "Christmas market in the village square",
    when: "Saturday 28 November · 10am to 4pm",
    body: "Local makers, mulled wine and carols from the brass band. A five-minute walk from the hotel.",
    qr: "Details",
  },
  {
    eyebrow: "What’s on nearby",
    title: "[VILLAGE] Winter Fayre",
    when: "Sunday 6 December · 11am to 3pm",
    body: "Craft stalls, a hog roast and rides for children on the recreation ground. Free entry.",
    qr: "Details",
  },
];

export const DEMO_INFO: InfoPage[] = [
  { title: "Guest Wi-Fi", qr: "Scan to join", rows: [
    { label: "Network", value: "[WI-FI NAME]" },
    { label: "Password", value: "[WI-FI PASSWORD]" },
  ] },
  { title: "Checking out", qr: "", rows: [
    { label: "Checkout", value: "By 11am" },
    { label: "Late checkout", value: "Until 1pm, ask at reception" },
    { label: "Luggage", value: "We can keep it safe all day" },
  ] },
  { title: "Dining today", qr: "", rows: [
    { label: "Breakfast", value: "7 to 10am" },
    { label: "Lunch", value: "12 to 2:30pm" },
    { label: "Afternoon tea", value: "2 to 5pm" },
    { label: "Dinner", value: "6:30 to 9pm" },
  ] },
  { title: "Today's special", qr: "See the menu", rows: [
    { label: "Dish", value: "[TODAY’S SPECIAL]" },
    { label: "Served", value: "Dinner, from 6:30pm" },
    { label: "Price", value: "[PRICE]" },
  ] },
  { title: "Offers for guests", qr: "", rows: [
    { label: "Spa", value: "10% off treatments, Monday to Thursday" },
    { label: "Bar", value: "[OFFER]" },
    { label: "Next stay", value: "Book direct for [DISCOUNT]" },
  ] },
];

export const DEMO_TIMETABLE: TimetableRoute[] = [
  { route: "1", to: "Stratford-upon-Avon", times: everyHour("07:46", 12) },
  { route: "1", to: "Moreton-in-Marsh", times: everyHour("07:35", 12) },
  { route: "21", to: "Broadway", times: everyHour("08:20", 10, 90) },
  { route: "21", to: "Chipping Campden", times: everyHour("08:40", 10, 90) },
];

export const DEMO_TRAINS: { to: string; times: string[] }[] = [
  { to: "London Paddington", times: everyHour("06:52", 16) },
  { to: "Worcester", times: everyHour("07:08", 16) },
];

export const DEMO_TAXIS: TravelPage = {
  title: "Local taxis",
  note: "Reception can book one for you",
  rows: [
    { badge: "Taxi", kind: "taxi", to: "[TAXI FIRM], 24 hours", time: "[PHONE]" },
    { badge: "Taxi", kind: "taxi", to: "[TAXI FIRM], up to 8 seats", time: "[PHONE]" },
    { badge: "Taxi", kind: "taxi", to: "[TAXI FIRM], card accepted", time: "[PHONE]" },
    { badge: "Car", kind: "car", to: "Airport transfers, a day ahead", time: "[PHONE]" },
  ],
};

export const DEMO_NOTICES: Notice[] = [
  { tag: "Travel", text: "A44 closed at Moreton-in-Marsh until 4pm. Use the A429 instead." },
  { tag: "Tonight", text: "Live jazz in the bar from 8pm." },
  { tag: "Weekend", text: "Christmas market in the village square on Saturday, 10am to 4pm." },
];

/** "07:46", 3 → ["07:46", "08:46", "09:46"]; step in minutes. */
export function everyHour(first: string, count: number, step = 60): string[] {
  const start = toMinutes(first);
  return Array.from({ length: count }, (_, i) => fromMinutes(start + i * step)).filter((t) => toMinutes(t) < 24 * 60);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type TimeState = "gone" | "next" | "later";

/**
 * A window of six times for one route around now: the last bus that has gone
 * (if any), then the next one and the ones after it.
 */
export function timetableWindow(times: string[], nowMinutes: number, size = 6): { at: string; state: TimeState }[] {
  const nextIndex = times.findIndex((t) => toMinutes(t) >= nowMinutes);
  const firstFuture = nextIndex === -1 ? times.length : nextIndex;
  const start = Math.max(0, Math.min(firstFuture - 1, times.length - size));
  return times.slice(start, start + size).map((at, i) => {
    const index = start + i;
    const state: TimeState = index < firstFuture ? "gone" : index === firstFuture ? "next" : "later";
    return { at, state };
  });
}

/** Under an hour away shows "4 min" ("Due" at 0); later shows the clock time. */
export function departureLabel(at: string, nowMinutes: number): string {
  const diff = toMinutes(at) - nowMinutes;
  if (diff <= 0) return "Due";
  if (diff < 60) return `${diff} min`;
  return at;
}

/** Next departures: the next bus per route and direction, then the next train per destination. */
export function nextDepartures(nowMinutes: number): TravelPage {
  const rows: TravelRow[] = [];
  for (const r of DEMO_TIMETABLE.slice(0, 3)) {
    const next = r.times.find((t) => toMinutes(t) >= nowMinutes);
    if (next) rows.push({ badge: r.route, kind: "bus", to: r.to, time: departureLabel(next, nowMinutes) });
  }
  for (const t of DEMO_TRAINS) {
    const next = t.times.find((at) => toMinutes(at) >= nowMinutes);
    if (next) rows.push({ badge: "Rail", kind: "rail", to: t.to, time: departureLabel(next, nowMinutes) });
  }
  rows.sort((a, b) => sortKey(a.time, nowMinutes) - sortKey(b.time, nowMinutes));
  return {
    title: "Next departures",
    note: rows.length ? "Live times where the operator sends them" : "No more departures today",
    rows: rows.slice(0, 4),
  };
}

function sortKey(label: string, nowMinutes: number): number {
  if (label === "Due") return 0;
  if (label.endsWith(" min")) return parseInt(label, 10);
  return toMinutes(label) - nowMinutes;
}

/** Open-Meteo / WMO weather codes in plain words. */
export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Sunny spells";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 65) return code === 65 ? "Heavy rain" : "Light rain";
  if (code === 66 || code === 67) return "Freezing rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed";
}

export type WeatherIcon = "sun" | "partly" | "cloud" | "rain" | "snow" | "storm" | "fog";

export function weatherIcon(code: number): WeatherIcon {
  if (code === 0) return "sun";
  if (code <= 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "rain";
}

/** Cycles a few pixels every few minutes so nothing sits still long enough to burn in. */
export const BURN_IN_OFFSETS: [number, number][] = [[0, 0], [4, 2], [-3, 4], [2, -4], [-4, -2]];
