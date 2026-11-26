// More → Hotel settings → Lobby Screen: what this hotel's TV (/tv) shows.
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCurrentHotel } from "@/lib/hotels";
import { defaultSettings, newId, parseTimes, type ScreenSettings } from "@/lib/tv-settings";
import {
  lookupPostcode,
  removeBrandingImage,
  saveScreenSettings,
  screenSettingsKey,
  uploadBrandingImage,
  useBrandingUrls,
  useScreenSettings,
} from "@/lib/tv-settings-data";

const errMsg = (e: unknown, f: string) => (e as { message?: string })?.message ?? f;

const imagePaths = (x: ScreenSettings) => [x.logo_path, x.photo_path, ...x.features.map((f) => f.photo_path)].filter((p): p is string => !!p);

const heading = (t: string) => <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}</p>;
const hint = (t: React.ReactNode) => <p className="text-xs text-muted-foreground">{t}</p>;

function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function OrderButtons({ onUp, onDown, onDelete, label }: { onUp: () => void; onDown: () => void; onDelete: () => void; label: string }) {
  return (
    <div className="flex shrink-0 items-center">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onUp} aria-label={`Move ${label} up`}><ArrowUp className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onDown} aria-label={`Move ${label} down`}><ArrowDown className="h-4 w-4" /></Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} aria-label={`Delete ${label}`}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

/** A comma-separated times field that keeps what's typed until it loses focus. */
function TimesInput({ value, onChange, placeholder }: { value: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return (
    <Textarea
      rows={2}
      value={text}
      placeholder={placeholder ?? "07:46, 08:46, 09:46"}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(parseTimes(text))}
    />
  );
}

function ImagePicker({ label, path, onPick, onClear, busy, tall }: { label: string; path: string | null; onPick: (f: File) => void; onClear: () => void; busy: boolean; tall?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const src = useBrandingUrls([path])(path);
  return (
    <div className="flex items-center gap-3">
      <div className={`flex ${tall ? "h-20 w-32" : "h-16 w-16"} shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted`}>
        {path && src ? <img src={src} alt="" className="h-full w-full object-contain" /> : path ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{path ? `Change ${label}` : `Upload ${label}`}
        </Button>
        {path && <Button type="button" variant="ghost" size="sm" onClick={onClear}>Remove</Button>}
      </div>
    </div>
  );
}

export function LobbyScreenSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const hotel = useCurrentHotel().data;
  const q = useScreenSettings(open ? hotel?.id : undefined);
  const [draft, setDraft] = useState<ScreenSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [postcode, setPostcode] = useState("");

  useEffect(() => {
    if (open && q.data && !dirty) {
      setDraft(q.data.settings);
      setPostcode(q.data.settings.postcode ?? "");
    }
  }, [open, q.data, dirty]);
  // Before the database update is applied the table is missing: show the starting examples, but saving can't work yet.
  const notReady = q.isError && /hotel_screen_settings/.test(errMsg(q.error, ""));
  useEffect(() => {
    if (open && notReady && hotel && !draft) setDraft(defaultSettings(hotel.id));
  }, [open, notReady, hotel, draft]);
  useEffect(() => { if (!open) { setDirty(false); setDraft(null); } }, [open]);

  const update = (fn: (s: ScreenSettings) => ScreenSettings) => {
    setDraft((s) => (s ? fn(s) : s));
    setDirty(true);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveScreenSettings(draft);
      // Images that were saved before but aren't used any more.
      const used = new Set(imagePaths(draft));
      for (const old of q.data ? imagePaths(q.data.settings) : []) if (!used.has(old)) void removeBrandingImage(old);
      setDirty(false);
      await qc.invalidateQueries({ queryKey: screenSettingsKey(draft.hotel_id) });
      toast.success("Lobby screen saved");
    } catch (e) {
      toast.error(errMsg(e, "Couldn't save the lobby screen."));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (kind: string, file: File, apply: (s: ScreenSettings, path: string) => ScreenSettings) => {
    if (!draft) return;
    setUploading(kind);
    try {
      const path = await uploadBrandingImage(draft.hotel_id, kind, file);
      update((s) => apply(s, path));
    } catch (e) {
      toast.error(errMsg(e, "Couldn't upload that image."));
    } finally {
      setUploading(null);
    }
  };

  const findPostcode = async () => {
    setLooking(true);
    try {
      const found = await lookupPostcode(postcode);
      if (!found) { toast.error("Couldn't find that postcode."); return; }
      setPostcode(found.postcode);
      update((s) => ({ ...s, postcode: found.postcode, latitude: found.latitude, longitude: found.longitude }));
      toast.success(`Location set to ${found.postcode}`);
    } catch {
      toast.error("Couldn't look up that postcode. Check the connection and try again.");
    } finally {
      setLooking(false);
    }
  };

  const s = draft;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Lobby Screen</SheetTitle>
          <SheetDescription>
            What the TV in reception shows for {hotel?.name ?? "this hotel"}. Open <span className="font-medium">/tv</span> on the TV's browser while signed in to this hotel.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => window.open("/tv", "_blank", "noopener")}>
            <ExternalLink className="mr-1.5 h-4 w-4" />Open the screen
          </Button>
          {s && <>
            <span className="ml-auto text-xs text-muted-foreground">{dirty ? "Unsaved changes" : q.data?.saved ? "Saved" : "Not saved yet"}</span>
            <Button type="button" variant="ghost" size="sm" disabled={!dirty || saving} onClick={() => { setDirty(false); setDraft(q.data?.settings ?? (hotel ? defaultSettings(hotel.id) : null)); }}>Discard</Button>
            <Button type="button" size="sm" disabled={notReady || (!dirty && q.data?.saved) || saving} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Save
            </Button>
          </>}
        </div>

        {notReady && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            The Lobby Screen database update hasn't been applied yet, so changes can't be saved. You can look around in the meantime.
          </p>
        )}

        {!s ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            {q.isError ? errMsg(q.error, "Couldn't load the lobby screen settings.") : <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>}
          </div>
        ) : (
          <Tabs defaultValue="look" className="mt-4">
            <TabsList className="flex w-full flex-wrap">
              <TabsTrigger value="look">Look</TabsTrigger>
              <TabsTrigger value="info">At the hotel</TabsTrigger>
              <TabsTrigger value="whats-on">What's on</TabsTrigger>
              <TabsTrigger value="travel">Travel</TabsTrigger>
              <TabsTrigger value="notices">Notices</TabsTrigger>
            </TabsList>

            {/* Look */}
            <TabsContent value="look">
              {heading("Logo")}
              <ImagePicker label="logo" path={s.logo_path} busy={uploading === "logo"}
                onPick={(f) => void upload("logo", f, (x, p) => ({ ...x, logo_path: p }))}
                onClear={() => update((x) => ({ ...x, logo_path: null }))} />
              {hint("A PNG with a see-through background looks best on the dark glass. Without one, the screen shows the hotel's initials.")}
              {heading("Background photo")}
              <ImagePicker label="photo" tall path={s.photo_path} busy={uploading === "photo"}
                onPick={(f) => void upload("photo", f, (x, p) => ({ ...x, photo_path: p }))}
                onClear={() => update((x) => ({ ...x, photo_path: null }))} />
              {hint("Shown blurred and darkened behind everything. A wide photo of the hotel works best.")}
              {heading("Welcome line")}
              <Input value={s.welcome} maxLength={80} onChange={(e) => update((x) => ({ ...x, welcome: e.target.value }))} placeholder="Welcome, we're glad you're here" />
            </TabsContent>

            {/* At the hotel */}
            <TabsContent value="info">
              {hint("Cards take turns in the At the hotel panel. Rows left empty aren't shown.")}
              {s.info_cards.map((card, i) => (
                <div key={card.id} className="mt-3 rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <Input className="font-medium" value={card.title} placeholder="Card title" onChange={(e) => update((x) => ({ ...x, info_cards: x.info_cards.map((c) => c.id === card.id ? { ...c, title: e.target.value } : c) }))} />
                    <Switch checked={card.show} aria-label="Show this card" onCheckedChange={(on) => update((x) => ({ ...x, info_cards: x.info_cards.map((c) => c.id === card.id ? { ...c, show: on } : c) }))} />
                    <OrderButtons label={card.title || "card"}
                      onUp={() => update((x) => ({ ...x, info_cards: move(x.info_cards, i, -1) }))}
                      onDown={() => update((x) => ({ ...x, info_cards: move(x.info_cards, i, 1) }))}
                      onDelete={() => update((x) => ({ ...x, info_cards: x.info_cards.filter((c) => c.id !== card.id) }))} />
                  </div>
                  {card.rows.map((row, r) => (
                    <div key={r} className="mt-2 flex items-center gap-2">
                      <Input className="w-36 shrink-0" value={row.label} placeholder="Label" onChange={(e) => update((x) => ({ ...x, info_cards: x.info_cards.map((c) => c.id === card.id ? { ...c, rows: c.rows.map((rr, k) => k === r ? { ...rr, label: e.target.value } : rr) } : c) }))} />
                      <Input value={row.value} placeholder="Shown on the screen" onChange={(e) => update((x) => ({ ...x, info_cards: x.info_cards.map((c) => c.id === card.id ? { ...c, rows: c.rows.map((rr, k) => k === r ? { ...rr, value: e.target.value } : rr) } : c) }))} />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Delete row" onClick={() => update((x) => ({ ...x, info_cards: x.info_cards.map((c) => c.id === card.id ? { ...c, rows: c.rows.filter((_, k) => k !== r) } : c) }))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" disabled={card.rows.length >= 5} onClick={() => update((x) => ({ ...x, info_cards: x.info_cards.map((c) => c.id === card.id ? { ...c, rows: [...c.rows, { label: "", value: "" }] } : c) }))}><Plus className="mr-1 h-4 w-4" />Row</Button>
                    <Input value={card.link} placeholder="Link for a QR code (optional)" onChange={(e) => update((x) => ({ ...x, info_cards: x.info_cards.map((c) => c.id === card.id ? { ...c, link: e.target.value } : c) }))} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => update((x) => ({ ...x, info_cards: [...x.info_cards, { id: newId(), title: "", rows: [{ label: "", value: "" }], link: "", show: true }] }))}>
                <Plus className="mr-1 h-4 w-4" />Add a card
              </Button>
            </TabsContent>

            {/* What's on */}
            <TabsContent value="whats-on">
              {hint("The large card. Use it for your other hotels, local events and fayres, or offers. Without any, it shows the welcome line.")}
              {s.features.map((f, i) => (
                <div key={f.id} className="mt-3 space-y-2 rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <Input value={f.eyebrow} placeholder="Small heading, e.g. What's on nearby" onChange={(e) => update((x) => ({ ...x, features: x.features.map((c) => c.id === f.id ? { ...c, eyebrow: e.target.value } : c) }))} />
                    <Switch checked={f.show} aria-label="Show this card" onCheckedChange={(on) => update((x) => ({ ...x, features: x.features.map((c) => c.id === f.id ? { ...c, show: on } : c) }))} />
                    <OrderButtons label={f.title || "card"}
                      onUp={() => update((x) => ({ ...x, features: move(x.features, i, -1) }))}
                      onDown={() => update((x) => ({ ...x, features: move(x.features, i, 1) }))}
                      onDelete={() => update((x) => ({ ...x, features: x.features.filter((c) => c.id !== f.id) }))} />
                  </div>
                  <Input className="font-medium" value={f.title} placeholder="Headline" onChange={(e) => update((x) => ({ ...x, features: x.features.map((c) => c.id === f.id ? { ...c, title: e.target.value } : c) }))} />
                  <Input value={f.when} placeholder="When, e.g. Saturday 28 November · 10am to 4pm (optional)" onChange={(e) => update((x) => ({ ...x, features: x.features.map((c) => c.id === f.id ? { ...c, when: e.target.value } : c) }))} />
                  <Textarea rows={2} value={f.body} maxLength={220} placeholder="A sentence or two" onChange={(e) => update((x) => ({ ...x, features: x.features.map((c) => c.id === f.id ? { ...c, body: e.target.value } : c) }))} />
                  <Input value={f.link} placeholder="Link for a QR code (optional)" onChange={(e) => update((x) => ({ ...x, features: x.features.map((c) => c.id === f.id ? { ...c, link: e.target.value } : c) }))} />
                  <ImagePicker label="photo" tall path={f.photo_path} busy={uploading === `feature-${f.id}`}
                    onPick={(file) => void upload(`feature-${f.id}`, file, (x, p) => ({ ...x, features: x.features.map((c) => c.id === f.id ? { ...c, photo_path: p } : c) }))}
                    onClear={() => update((x) => ({ ...x, features: x.features.map((c) => c.id === f.id ? { ...c, photo_path: null } : c) }))} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => update((x) => ({ ...x, features: [...x.features, { id: newId(), eyebrow: "What's on nearby", title: "", when: "", body: "", link: "", photo_path: null, show: true }] }))}>
                <Plus className="mr-1 h-4 w-4" />Add a card
              </Button>
            </TabsContent>

            {/* Travel */}
            <TabsContent value="travel">
              {heading("Location")}
              <div className="flex gap-2">
                <Input value={postcode} placeholder="Hotel postcode" onChange={(e) => setPostcode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void findPostcode(); }} />
                <Button type="button" variant="outline" disabled={looking || !postcode.trim()} onClick={() => void findPostcode()}>
                  {looking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MapPin className="mr-1.5 h-4 w-4" />}Find
                </Button>
              </div>
              {hint(s.latitude != null && s.longitude != null
                ? <>Set to {s.postcode ?? "a custom spot"} ({s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}). The weather comes from here.</>
                : "Used for the weather, and later for nearby road closures and live bus times.")}

              {heading("Live services")}
              <div className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center justify-between gap-3 text-sm"><span>Weather</span><span className="text-muted-foreground">{s.latitude != null ? "On, from the location" : "Needs the location"}</span></div>
                <label className="block text-sm">Bus stops for live times
                  <Input className="mt-1" value={s.bus_stops.map((b) => b.code).join(", ")} placeholder="Stop codes, e.g. 160000000000"
                    onChange={(e) => update((x) => ({ ...x, bus_stops: e.target.value.split(/[\s,]+/).filter(Boolean).slice(0, 3).map((code) => ({ code, name: x.bus_stops.find((b) => b.code === code)?.name ?? "" })) }))} />
                </label>
                {hint(<>Find a stop's code on its page at <a className="underline" href="https://bustimes.org" target="_blank" rel="noreferrer">bustimes.org</a> (the ATCO code). Up to three.</>)}
                <label className="block text-sm">Railway station code
                  <Input className="mt-1 w-28 uppercase" maxLength={3} value={s.rail_station ?? ""} placeholder="HYB"
                    onChange={(e) => update((x) => ({ ...x, rail_station: e.target.value.toUpperCase() || null }))} />
                </label>
                <label className="block text-sm">Road closures within (miles)
                  <Input className="mt-1 w-28" type="number" min={1} max={50} value={s.road_radius_miles}
                    onChange={(e) => update((x) => ({ ...x, road_radius_miles: Math.max(1, Math.min(50, Number(e.target.value) || 10)) }))} />
                </label>
                {hint("Live bus times, trains and road closures are switched on once their data feeds are connected. Until then the screen uses the timetables below and the notices you type in.")}
              </div>

              {heading("Bus timetable")}
              {s.bus_timetable.map((r, i) => (
                <div key={r.id} className="mt-2 space-y-2 rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <Input className="w-20 shrink-0" value={r.route} placeholder="Route" onChange={(e) => update((x) => ({ ...x, bus_timetable: x.bus_timetable.map((c) => c.id === r.id ? { ...c, route: e.target.value } : c) }))} />
                    <Input value={r.to} placeholder="Towards" onChange={(e) => update((x) => ({ ...x, bus_timetable: x.bus_timetable.map((c) => c.id === r.id ? { ...c, to: e.target.value } : c) }))} />
                    <OrderButtons label={r.to || "route"}
                      onUp={() => update((x) => ({ ...x, bus_timetable: move(x.bus_timetable, i, -1) }))}
                      onDown={() => update((x) => ({ ...x, bus_timetable: move(x.bus_timetable, i, 1) }))}
                      onDelete={() => update((x) => ({ ...x, bus_timetable: x.bus_timetable.filter((c) => c.id !== r.id) }))} />
                  </div>
                  <TimesInput value={r.times} onChange={(t) => update((x) => ({ ...x, bus_timetable: x.bus_timetable.map((c) => c.id === r.id ? { ...c, times: t } : c) }))} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="mt-2" disabled={s.bus_timetable.length >= 4} onClick={() => update((x) => ({ ...x, bus_timetable: [...x.bus_timetable, { id: newId(), route: "", to: "", times: [] }] }))}>
                <Plus className="mr-1 h-4 w-4" />Add a bus route
              </Button>
              {hint("Up to four. Type the times leaving your nearest stop, separated by commas.")}

              {heading("Trains")}
              {s.trains.map((t, i) => (
                <div key={t.id} className="mt-2 space-y-2 rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <Input value={t.to} placeholder="Towards, e.g. London Paddington" onChange={(e) => update((x) => ({ ...x, trains: x.trains.map((c) => c.id === t.id ? { ...c, to: e.target.value } : c) }))} />
                    <OrderButtons label={t.to || "train"}
                      onUp={() => update((x) => ({ ...x, trains: move(x.trains, i, -1) }))}
                      onDown={() => update((x) => ({ ...x, trains: move(x.trains, i, 1) }))}
                      onDelete={() => update((x) => ({ ...x, trains: x.trains.filter((c) => c.id !== t.id) }))} />
                  </div>
                  <TimesInput value={t.times} placeholder="06:52, 07:52, 08:52" onChange={(v) => update((x) => ({ ...x, trains: x.trains.map((c) => c.id === t.id ? { ...c, times: v } : c) }))} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => update((x) => ({ ...x, trains: [...x.trains, { id: newId(), to: "", times: [] }] }))}>
                <Plus className="mr-1 h-4 w-4" />Add a train line
              </Button>

              {heading("Taxis")}
              {s.taxis.map((t, i) => (
                <div key={t.id} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border p-3">
                  <Input className="min-w-40 flex-1" value={t.name} placeholder="Firm" onChange={(e) => update((x) => ({ ...x, taxis: x.taxis.map((c) => c.id === t.id ? { ...c, name: e.target.value } : c) }))} />
                  <Input className="w-36" value={t.phone} placeholder="Phone" onChange={(e) => update((x) => ({ ...x, taxis: x.taxis.map((c) => c.id === t.id ? { ...c, phone: e.target.value } : c) }))} />
                  <Input className="min-w-40 flex-1" value={t.note} placeholder="Note, e.g. 24 hours" onChange={(e) => update((x) => ({ ...x, taxis: x.taxis.map((c) => c.id === t.id ? { ...c, note: e.target.value } : c) }))} />
                  <OrderButtons label={t.name || "taxi"}
                    onUp={() => update((x) => ({ ...x, taxis: move(x.taxis, i, -1) }))}
                    onDown={() => update((x) => ({ ...x, taxis: move(x.taxis, i, 1) }))}
                    onDelete={() => update((x) => ({ ...x, taxis: x.taxis.filter((c) => c.id !== t.id) }))} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="mt-2" disabled={s.taxis.length >= 4} onClick={() => update((x) => ({ ...x, taxis: [...x.taxis, { id: newId(), name: "", note: "", phone: "" }] }))}>
                <Plus className="mr-1 h-4 w-4" />Add a taxi firm
              </Button>
            </TabsContent>

            {/* Notices */}
            <TabsContent value="notices">
              {hint("Short lines that fade in turn along the bottom of the screen, such as road closures or tonight's entertainment.")}
              {s.notices.map((n, i) => (
                <div key={n.id} className="mt-2 flex items-center gap-2 rounded-xl border p-3">
                  <Input className="w-28 shrink-0" value={n.tag} placeholder="Travel" maxLength={12} onChange={(e) => update((x) => ({ ...x, notices: x.notices.map((c) => c.id === n.id ? { ...c, tag: e.target.value } : c) }))} />
                  <Input value={n.text} maxLength={110} placeholder="A44 closed at Moreton until 4pm" onChange={(e) => update((x) => ({ ...x, notices: x.notices.map((c) => c.id === n.id ? { ...c, text: e.target.value } : c) }))} />
                  <Switch checked={n.show} aria-label="Show this notice" onCheckedChange={(on) => update((x) => ({ ...x, notices: x.notices.map((c) => c.id === n.id ? { ...c, show: on } : c) }))} />
                  <OrderButtons label={n.text || "notice"}
                    onUp={() => update((x) => ({ ...x, notices: move(x.notices, i, -1) }))}
                    onDown={() => update((x) => ({ ...x, notices: move(x.notices, i, 1) }))}
                    onDelete={() => update((x) => ({ ...x, notices: x.notices.filter((c) => c.id !== n.id) }))} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => update((x) => ({ ...x, notices: [...x.notices, { id: newId(), tag: "", text: "", show: true }] }))}>
                <Plus className="mr-1 h-4 w-4" />Add a notice
              </Button>
            </TabsContent>
          </Tabs>
        )}

      </SheetContent>
    </Sheet>
  );
}
