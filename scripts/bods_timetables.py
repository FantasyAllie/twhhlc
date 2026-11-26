#!/usr/bin/env python3
"""Daily bus timetables for the lobby TV, from the Bus Open Data Service (England).

For every hotel whose Lobby Screen lists bus stop codes (hotel_screen_settings.bus_stops),
this reads BODS timetable data (TransXChange), works out the departures from those stops
for the next seven days, and saves them in hotel_screen_settings.bus_timetable_auto.

Runs daily from .github/workflows/bus-timetables.yml. Needs only the Python standard library.

Environment:
  BODS_API_KEY               personal key from data.bus-data.dft.gov.uk (Account settings)
  SUPABASE_URL               https://<project>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY  service role key (writes past RLS)

Try it without the database:
  BODS_API_KEY=... python3 scripts/bods_timetables.py --stops 1600EXAMPLE --days 1
"""
import argparse
import datetime as dt
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict

NS = "{http://www.transxchange.org.uk/}"
BODS = "https://data.bus-data.dft.gov.uk"
UA = "Tsuyu lobby screen timetable job"
DAYS_AHEAD = 7

try:
    from zoneinfo import ZoneInfo  # Python 3.9+
    LONDON = ZoneInfo("Europe/London")
except Exception:  # pragma: no cover
    LONDON = None


# ---------- small helpers ----------

def http_get(url, headers=None, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.read()


def text(el, path):
    found = el.find(path) if el is not None else None
    return found.text.strip() if found is not None and found.text else None


DURATION = re.compile(r"^-?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$")


def seconds(iso):
    """ISO 8601 duration (PT3M, PT1H2M30S) → seconds. Missing or odd → 0."""
    if not iso:
        return 0
    m = DURATION.match(iso.strip())
    if not m:
        return 0
    d, h, mi, s = m.groups()
    return int(d or 0) * 86400 + int(h or 0) * 3600 + int(mi or 0) * 60 + int(float(s or 0))


def clock(secs):
    return "%02d:%02d" % (secs // 3600, (secs % 3600) // 60)


def parse_time(hhmmss):
    parts = [int(p) for p in hhmmss.split(":")]
    while len(parts) < 3:
        parts.append(0)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]


def parse_date(s):
    return dt.date.fromisoformat(s[:10]) if s else None


# ---------- bank holidays ----------

def bank_holiday_names(fetch=http_get):
    """date → set of TransXChange bank holiday names (England and Wales, from GOV.UK)."""
    names = defaultdict(set)
    try:
        data = json.loads(fetch("https://www.gov.uk/bank-holidays.json"))
        events = data["england-and-wales"]["events"]
    except Exception as e:  # no holidays is better than no timetable
        print("warning: couldn't load bank holidays:", e, file=sys.stderr)
        events = []
    for ev in events:
        d = parse_date(ev["date"])
        title = ev["title"].lower()
        if "new year" in title:
            n = "NewYearsDay" if (d.month, d.day) == (1, 1) else "NewYearsDayHoliday"
        elif "good friday" in title:
            n = "GoodFriday"
        elif "easter monday" in title:
            n = "EasterMonday"
        elif "early may" in title:
            n = "MayDay"
        elif "spring" in title:
            n = "SpringBank"
        elif "summer" in title:
            n = "LateSummerBankHolidayNotScotland"
        elif "christmas" in title:
            n = "ChristmasDay" if (d.month, d.day) == (12, 25) else "ChristmasDayHoliday"
        elif "boxing" in title:
            n = "BoxingDay" if (d.month, d.day) == (12, 26) else "BoxingDayHoliday"
        else:
            n = "OtherPublicHoliday"
        names[d].update({n, "AllBankHolidays"})
        if n not in ("ChristmasDay", "BoxingDay", "ChristmasDayHoliday", "BoxingDayHoliday"):
            names[d].add("AllHolidaysExceptChristmas")
        if n in ("ChristmasDay", "BoxingDay"):
            names[d].add("Christmas")
        if n in ("ChristmasDayHoliday", "BoxingDayHoliday", "NewYearsDayHoliday"):
            names[d].add("HolidayMondays")
    return names


def holidays_on(d, table):
    out = set(table.get(d, set()))
    if (d.month, d.day) == (12, 24):
        out.update({"ChristmasEve", "EarlyRunOff"})
    if (d.month, d.day) == (12, 31):
        out.update({"NewYearsEve", "EarlyRunOff"})
    return out


# ---------- operating profiles ----------

WEEKDAY_SETS = {
    "Monday": {0}, "Tuesday": {1}, "Wednesday": {2}, "Thursday": {3}, "Friday": {4},
    "Saturday": {5}, "Sunday": {6},
    "MondayToFriday": {0, 1, 2, 3, 4}, "MondayToSaturday": {0, 1, 2, 3, 4, 5},
    "MondayToSunday": set(range(7)), "Weekend": {5, 6},
    "NotMonday": set(range(7)) - {0}, "NotTuesday": set(range(7)) - {1},
    "NotWednesday": set(range(7)) - {2}, "NotThursday": set(range(7)) - {3},
    "NotFriday": set(range(7)) - {4}, "NotSaturday": set(range(7)) - {5},
    "NotSunday": set(range(7)) - {6},
}


def in_ranges(el, d):
    for r in el.iter(NS + "DateRange"):
        start = parse_date(text(r, NS + "StartDate"))
        end = parse_date(text(r, NS + "EndDate")) or start
        if start and start <= d <= end:
            return True
    return False


def holiday_tags(el):
    return {child.tag.replace(NS, "") for child in el} if el is not None else set()


def runs_on(profile, d, holiday_table):
    """Does a journey with this OperatingProfile run on date d? (No profile: every day.)"""
    if profile is None:
        return True
    special = profile.find(NS + "SpecialDaysOperation")
    if special is not None:
        non = special.find(NS + "DaysOfNonOperation")
        if non is not None and in_ranges(non, d):
            return False
        on = special.find(NS + "DaysOfOperation")
        if on is not None and in_ranges(on, d):
            return True
    hols = holidays_on(d, holiday_table)
    bank = profile.find(NS + "BankHolidayOperation")
    if bank is not None and hols:
        if holiday_tags(bank.find(NS + "DaysOfNonOperation")) & hols:
            return False
        if holiday_tags(bank.find(NS + "DaysOfOperation")) & hols:
            return True
    # Journeys that only run on school days (or only in school holidays) can't be placed
    # without each school's term dates, so they're left out rather than shown wrongly.
    serviced = profile.find(NS + "ServicedOrganisationDayType")
    if serviced is not None and serviced.find(NS + "DaysOfOperation") is not None:
        return False
    regular = profile.find(NS + "RegularDayType")
    if regular is None:
        return True
    if regular.find(NS + "HolidaysOnly") is not None:
        return False
    days = regular.find(NS + "DaysOfWeek")
    if days is None:
        return True
    allowed = set()
    for child in days:
        allowed |= WEEKDAY_SETS.get(child.tag.replace(NS, ""), set())
    return d.weekday() in allowed


# ---------- TransXChange ----------

def clean(s):
    return re.sub(r"\s+", " ", s).strip() if s else ""


def departures_in_txc(xml_bytes, wanted, dates, holiday_table):
    """Yield (date, stop, route, to, "HH:MM") for every departure from a wanted stop."""
    root = ET.fromstring(xml_bytes)

    stop_names = {}
    for sp in root.iter(NS + "AnnotatedStopPointRef"):
        code = text(sp, NS + "StopPointRef")
        if code in wanted:
            stop_names[code] = clean(text(sp, NS + "CommonName"))

    sections = {}
    for sec in root.iter(NS + "JourneyPatternSection"):
        links = []
        for link in sec.findall(NS + "JourneyPatternTimingLink"):
            frm, to = link.find(NS + "From"), link.find(NS + "To")
            links.append({
                "id": link.get("id"),
                "from": text(frm, NS + "StopPointRef"),
                "from_wait": seconds(text(frm, NS + "WaitTime")),
                "from_activity": text(frm, NS + "Activity") or "pickUpAndSetDown",
                "to": text(to, NS + "StopPointRef"),
                "to_wait": seconds(text(to, NS + "WaitTime")),
                "run": seconds(text(link, NS + "RunTime")),
            })
        sections[sec.get("id")] = links

    services, patterns = {}, {}
    for svc in root.iter(NS + "Service"):
        code = text(svc, NS + "ServiceCode")
        lines = {ln.get("id"): clean(text(ln, NS + "LineName")) for ln in svc.iter(NS + "Line")}
        period = svc.find(NS + "OperatingPeriod")
        std = svc.find(NS + "StandardService")
        services[code] = {
            "lines": lines,
            "start": parse_date(text(period, NS + "StartDate")),
            "end": parse_date(text(period, NS + "EndDate")),
            "profile": svc.find(NS + "OperatingProfile"),
            "dest": clean(text(std, NS + "Destination")),
        }
        if std is not None:
            for jp in std.findall(NS + "JourneyPattern"):
                patterns[jp.get("id")] = {
                    "sections": [r.text.strip() for r in jp.findall(NS + "JourneyPatternSectionRefs") if r.text],
                    "dest": clean(text(jp, NS + "DestinationDisplay")),
                    "service": code,
                }

    journeys = {vj_code: vj for vj_code, vj in ((text(v, NS + "VehicleJourneyCode"), v) for v in root.iter(NS + "VehicleJourney"))}

    for vj in root.iter(NS + "VehicleJourney"):
        jp_ref = text(vj, NS + "JourneyPatternRef")
        if not jp_ref:  # a journey that borrows another's pattern
            other = journeys.get(text(vj, NS + "VehicleJourneyRef") or "")
            jp_ref = text(other, NS + "JourneyPatternRef") if other is not None else None
        pattern = patterns.get(jp_ref or "")
        if not pattern:
            continue
        links = [l for ref in pattern["sections"] for l in sections.get(ref, [])]
        if not any(l["from"] in wanted for l in links):
            continue
        svc = services.get(text(vj, NS + "ServiceRef") or pattern["service"], {})
        route = svc.get("lines", {}).get(text(vj, NS + "LineRef")) or next(iter(svc.get("lines", {}).values()), "")
        dest = clean(text(vj, NS + "DestinationDisplay")) or pattern["dest"] or svc.get("dest", "")
        profile = vj.find(NS + "OperatingProfile")
        if profile is None:
            profile = svc.get("profile")

        overrides = {}
        for vl in vj.findall(NS + "VehicleJourneyTimingLink"):
            overrides[text(vl, NS + "JourneyPatternTimingLinkRef")] = {
                "run": text(vl, NS + "RunTime"),
                "from_wait": text(vl.find(NS + "From"), NS + "WaitTime") if vl.find(NS + "From") is not None else None,
                "to_wait": text(vl.find(NS + "To"), NS + "WaitTime") if vl.find(NS + "To") is not None else None,
            }

        start_time = text(vj, NS + "DepartureTime")
        if not start_time:
            continue
        t = parse_time(start_time)
        stop_times = []
        for l in links:
            o = overrides.get(l["id"], {})
            t += seconds(o["from_wait"]) if o.get("from_wait") else l["from_wait"]
            if l["from"] in wanted and l["from_activity"] != "setDown":
                stop_times.append((l["from"], t))
            t += seconds(o["run"]) if o.get("run") else l["run"]
            t += seconds(o["to_wait"]) if o.get("to_wait") else l["to_wait"]

        for d in dates:
            if svc.get("start") and d < svc["start"]:
                continue
            if svc.get("end") and d > svc["end"]:
                continue
            if not runs_on(profile, d, holiday_table):
                continue
            for stop, secs in stop_times:
                if secs < 24 * 3600:  # after-midnight runs belong to the next day: left out
                    yield d, stop, route, dest, clock(secs)

    yield ("names", stop_names)


def xml_files(blob):
    """A dataset download is either one XML file or a zip of them (sometimes nested)."""
    if blob[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            for name in z.namelist():
                if name.lower().endswith(".xml"):
                    yield z.read(name)
                elif name.lower().endswith(".zip"):
                    yield from xml_files(z.read(name))
    else:
        yield blob


# ---------- BODS ----------

def bods_datasets(api_key, admin_area):
    url = f"{BODS}/api/v1/dataset/?" + urllib.parse.urlencode({
        "adminArea": admin_area, "status": "published", "limit": 100, "api_key": api_key,
    })
    while url:
        page = json.loads(http_get(url))
        for ds in page.get("results", []):
            yield ds
        url = page.get("next")


def download_dataset(ds, api_key):
    url = ds.get("url")
    if not url:
        return b""
    if url.startswith(BODS) and "api_key=" not in url:
        url += ("&" if "?" in url else "?") + "api_key=" + urllib.parse.quote(api_key)
    return http_get(url, timeout=300)


def build_timetables(stops_by_hotel, api_key, today, days=DAYS_AHEAD, fetch_holidays=http_get):
    """{hotel_id: [stop codes]} → {hotel_id: bus_timetable_auto object}."""
    all_stops = {s for stops in stops_by_hotel.values() for s in stops}
    areas = sorted({s[:3] for s in all_stops if len(s) >= 3})
    dates = [today + dt.timedelta(days=i) for i in range(days)]
    holiday_table = bank_holiday_names(fetch_holidays)
    found = defaultdict(set)  # (date, stop) → {(route, to, time)}
    names = {}
    seen = set()
    for area in areas:
        for ds in bods_datasets(api_key, area):
            if ds.get("id") in seen:
                continue
            seen.add(ds.get("id"))
            try:
                blob = download_dataset(ds, api_key)
            except Exception as e:
                print(f"warning: dataset {ds.get('id')} didn't download: {e}", file=sys.stderr)
                continue
            for xml in xml_files(blob):
                if not any(s.encode() in xml for s in all_stops):
                    continue  # quick skip: none of our stops in this file
                try:
                    for row in departures_in_txc(xml, all_stops, dates, holiday_table):
                        if row[0] == "names":
                            names.update({k: v for k, v in row[1].items() if v})
                            continue
                        d, stop, route, to, at = row
                        found[(d, stop)].add((route, to, at))
                except ET.ParseError as e:
                    print(f"warning: dataset {ds.get('id')} has a file that isn't valid XML: {e}", file=sys.stderr)

    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    out = {}
    for hotel, stops in stops_by_hotel.items():
        day_list = []
        for d in dates:
            groups = defaultdict(set)
            for stop in stops:
                for route, to, at in found.get((d, stop), ()):
                    groups[(route, to)].add(at)
            routes = [{"route": r, "to": t, "times": sorted(times)} for (r, t), times in groups.items()]
            routes.sort(key=lambda x: (-len(x["times"]), x["route"], x["to"]))
            day_list.append({"date": d.isoformat(), "routes": routes})
        out[hotel] = {
            "generated_at": now,
            "stops": [{"code": s, "name": names.get(s, "")} for s in stops],
            "days": day_list,
            "error": None if any(day["routes"] for day in day_list) else "No departures found for these stop codes in BODS.",
        }
    return out


# ---------- Supabase ----------

def supabase(path, method="GET", body=None):
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(
        f"{base}/rest/v1/{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
            "User-Agent": UA,
        },
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        raw = res.read()
        return json.loads(raw) if raw else None


def london_today():
    return dt.datetime.now(LONDON).date() if LONDON else dt.date.today()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stops", help="comma-separated stop codes: print departures instead of saving")
    ap.add_argument("--days", type=int, default=DAYS_AHEAD)
    args = ap.parse_args()

    api_key = os.environ.get("BODS_API_KEY")
    if not api_key:
        sys.exit("BODS_API_KEY is not set.")

    if args.stops:
        stops = [s.strip() for s in args.stops.split(",") if s.strip()]
        result = build_timetables({"test": stops}, api_key, london_today(), args.days)["test"]
        print(json.dumps(result, indent=2))
        return

    rows = supabase("hotel_screen_settings?select=hotel_id,bus_stops")
    stops_by_hotel = {}
    for row in rows or []:
        codes = [s.get("code", "").strip() for s in (row.get("bus_stops") or []) if isinstance(s, dict)]
        codes = [c for c in codes if c]
        if codes:
            stops_by_hotel[row["hotel_id"]] = codes
    print(f"{len(stops_by_hotel)} hotel(s) with bus stops")
    if not stops_by_hotel:
        return
    results = build_timetables(stops_by_hotel, api_key, london_today(), args.days)
    for hotel, data in results.items():
        supabase(f"hotel_screen_settings?hotel_id=eq.{urllib.parse.quote(hotel)}", "PATCH", {"bus_timetable_auto": data})
        total = sum(len(r["times"]) for r in data["days"][0]["routes"]) if data["days"] else 0
        print(f"hotel {hotel[:8]}…: {total} departures today, {len(data['stops'])} stop(s)")


if __name__ == "__main__":
    main()
