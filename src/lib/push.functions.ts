import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Departments are what notifications actually target. In user_roles a
// department membership is a sub-role (housekeeper / reception / fnb /
// maintenance); admin / manager / developer / regional_admin are positions and
// say nothing about which department alerts someone should receive.
type Dept = "housekeeping" | "reception" | "fnb" | "maintenance";

const SUBROLE_DEPT: Record<string, Dept> = {
  housekeeper: "housekeeping",
  reception: "reception",
  fnb: "fnb",
  maintenance: "maintenance",
};
const ELEVATED = new Set(["developer", "regional_admin", "admin", "manager"]);

function deptsFromRoles(roles: string[]): { depts: Dept[]; elevated: boolean } {
  const depts: Dept[] = [];
  let elevated = false;
  for (const r of roles) {
    if (ELEVATED.has(r)) elevated = true;
    const d = SUBROLE_DEPT[r];
    if (d && !depts.includes(d)) depts.push(d);
  }
  return { depts, elevated };
}

async function getActor(ctx: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const db = await getDb();
  const [{ data: profile }, { data: roleRows }, { data: activeHotel }] = await Promise.all([
    db.from("profiles").select("display_name, email").eq("id", ctx.userId).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", ctx.userId),
    db.from("user_active_hotel").select("hotel_id").eq("user_id", ctx.userId).maybeSingle(),
  ]);
  const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
  const { depts, elevated } = deptsFromRoles(roles);
  let hotelId = (activeHotel as { hotel_id: string } | null)?.hotel_id ?? null;
  if (!hotelId) {
    const { data: member } = await db
      .from("hotel_members")
      .select("hotel_id")
      .eq("user_id", ctx.userId)
      .limit(1)
      .maybeSingle();
    hotelId = (member as { hotel_id: string } | null)?.hotel_id ?? null;
  }
  const p = profile as { display_name: string | null; email: string | null } | null;
  const username = p?.display_name || (p?.email ?? "").split("@")[0] || "user";
  const active = roles.some((r) => r !== "pending");
  return { id: ctx.userId, username, roles, depts, elevated, hotelId, active };
}

/**
 * Everyone in `depts` who shares the sender's hotel, minus the sender.
 * Elevated accounts with no department assigned at all still get alerts so an
 * admin/developer account is never silently cut out.
 */
async function recipientIdsForDepts(
  depts: Dept[],
  hotelId: string | null,
  excludeUserId: string,
): Promise<string[]> {
  const db = await getDb();
  let scopedIds: string[] | null = null;
  if (hotelId) {
    const { data: members } = await db
      .from("hotel_members")
      .select("user_id")
      .eq("hotel_id", hotelId);
    scopedIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
    if (scopedIds.length === 0) return [];
  }

  let q = db.from("user_roles").select("user_id,role");
  if (scopedIds) q = q.in("user_id", scopedIds);
  const { data: roleRows } = await q;
  const byUser = new Map<string, string[]>();
  for (const r of (roleRows ?? []) as { user_id: string; role: string }[]) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r.role);
    byUser.set(r.user_id, list);
  }

  const wanted = new Set(depts);
  const out: string[] = [];
  for (const [userId, roles] of byUser) {
    if (userId === excludeUserId) continue;
    const { depts: userDepts, elevated } = deptsFromRoles(roles);
    const inDept = userDepts.some((d) => wanted.has(d));
    if (inDept || (elevated && userDepts.length === 0)) out.push(userId);
  }
  return out;
}

async function filterByPref(
  userIds: string[],
  prefColumn: keyof NotificationPrefs,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const db = await getDb();
  const { data: prefsRows } = await db
    .from("notification_preferences" as never)
    .select(`user_id,${prefColumn}`)
    .in("user_id", userIds);
  const disabled = new Set<string>();
  for (const p of (prefsRows ?? []) as Array<Record<string, unknown>>) {
    if (p[prefColumn] === false) disabled.add(p.user_id as string);
  }
  return userIds.filter((id) => !disabled.has(id));
}

async function subsForUsers(userIds: string[]): Promise<SubRow[]> {
  if (userIds.length === 0) return [];
  const db = await getDb();
  const { data: subRows } = await db
    .from("push_subscriptions" as never)
    .select("id,user_id,endpoint,p256dh,auth")
    .in("user_id", userIds);
  return (subRows ?? []) as SubRow[];
}

// Voids the whole "who gets this" pipeline into one call.
async function fanOut(
  depts: Dept[],
  prefColumn: keyof NotificationPrefs,
  sender: { id: string; hotelId: string | null },
  body: { title: string; body: string; url?: string; tag?: string },
): Promise<number> {
  const ids = await recipientIdsForDepts(depts, sender.hotelId, sender.id);
  const optedIn = await filterByPref(ids, prefColumn);
  const subs = await subsForUsers(optedIn);
  await sendToSubs(subs, body);
  return subs.length;
}

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
});

export const subscribeToPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) => d,
  )
  .handler(async ({ data, context }) => {
    if (!data.endpoint || !data.p256dh || !data.auth) throw new Error("Invalid subscription");
    const db = await getDb();
    const { error } = await db
      .from("push_subscriptions" as never)
      .upsert(
        {
          user_id: context.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
          last_used_at: new Date().toISOString(),
        } as never,
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsubscribeFromPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await getDb();
    const { error } = await db
      .from("push_subscriptions" as never)
      .delete()
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PREF_KEYS = [
  "messages_enabled",
  "checkout_enabled",
  "done_enabled",
  "notify_from_reception",
  "notify_from_housekeeping",
  "notify_from_fnb",
  "notify_from_maintenance",
  "notify_maintenance_requests",
  "notify_early_checkin",
  "notify_late_checkout",
  "notify_stayover_out",
  "notify_dog_box",
  "notify_lost_property_logged",
  "notify_lost_property_collected",
  "notify_maintenance_completed",
] as const;

export type NotificationPrefs = Record<(typeof PREF_KEYS)[number], boolean>;

const DEFAULT_PREFS: NotificationPrefs = PREF_KEYS.reduce((acc, k) => {
  acc[k] = true;
  return acc;
}, {} as NotificationPrefs);

export const getNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPrefs> => {
    const db = await getDb();
    const { data: row } = await db
      .from("notification_preferences" as never)
      .select(PREF_KEYS.join(","))
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(row as Partial<NotificationPrefs>) };
  });

export const setNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<NotificationPrefs>) => d)
  .handler(async ({ data, context }) => {
    const db = await getDb();
    const patch: Record<string, unknown> = { user_id: context.userId };
    for (const k of PREF_KEYS) {
      if (typeof data[k] === "boolean") patch[k] = data[k];
    }
    const { error } = await db
      .from("notification_preferences" as never)
      .upsert(patch as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type SubRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendToSubs(
  subs: SubRow[],
  body: { title: string; body: string; url?: string; tag?: string },
): Promise<void> {
  if (subs.length === 0) return;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@twhh.site";
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("VAPID keys missing; cannot send push");
    return;
  }
  const { sendWebPush } = await import("./web-push.server");
  const payload = JSON.stringify(body);
  const results = await Promise.all(
    subs.map((s) =>
      sendWebPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload,
        { vapidPublicKey, vapidPrivateKey, subject, urgency: "high" },
      ),
    ),
  );
  const goneEndpoints = results.filter((r) => r.gone).map((r) => r.endpoint);
  if (goneEndpoints.length > 0) {
    const db = await getDb();
    await db
      .from("push_subscriptions" as never)
      .delete()
      .in("endpoint", goneEndpoints);
  }
  for (const r of results) {
    const host = (() => { try { return new URL(r.endpoint).host; } catch { return "?"; } })();
    if (r.ok) {
      console.log(`push OK status=${r.status} host=${host}`);
    } else {
      console.warn(`push FAIL status=${r.status} gone=${r.gone} host=${host} err=${r.error ?? ""}`);
    }
  }
}

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await getDb();
    const { data: rows } = await db
      .from("push_subscriptions" as never)
      .select("id,user_id,endpoint,p256dh,auth")
      .eq("user_id", context.userId);
    const subs = (rows ?? []) as SubRow[];
    await sendToSubs(subs, {
      title: "The Hotel Hub — Test notification",
      body: "If you can see this, push notifications are working on this device.",
      url: "/app",
    });
    return { ok: true, sent: subs.length };
  });

export type RoomEventKind =
  | "message"
  | "checkout"
  | "done"
  | "early_checkin"
  | "late_checkout"
  | "stayover_out"
  | "dog_box";

export const notifyRoomEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      kind: RoomEventKind;
      roomNumber: number;
      messageText?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const sender = await getActor(context);
    if (!sender.active) return { ok: true, recipients: 0 };

    // Pick target departments + which preference column to require.
    let targetDepts: Dept[];
    let prefColumn: keyof NotificationPrefs;
    let title: string;
    let body: string;
    switch (data.kind) {
      case "message":
        // Reception sends -> housekeeping receives, and vice versa. When the
        // sender sits in both departments, notify both halves.
        targetDepts =
          sender.depts.includes("reception") && !sender.depts.includes("housekeeping")
            ? ["housekeeping"]
            : sender.depts.includes("housekeeping") && !sender.depts.includes("reception")
            ? ["reception"]
            : ["housekeeping", "reception"];
        prefColumn = "messages_enabled";
        title = `Room ${data.roomNumber} — Message from ${sender.username}`;
        body = data.messageText?.slice(0, 240) ?? "New message";
        break;
      case "checkout":
        targetDepts = ["housekeeping"];
        prefColumn = "checkout_enabled";
        title = `Room ${data.roomNumber} — Guest checked out`;
        body = `Reception (${sender.username}) marked room ${data.roomNumber} as checked out.`;
        break;
      case "done":
        targetDepts = ["reception"];
        prefColumn = "done_enabled";
        title = `Room ${data.roomNumber} — Marked done`;
        body = `Housekeeping (${sender.username}) marked room ${data.roomNumber} as done.`;
        break;
      default:
        throw new Error("Unknown event kind");
    }

    const recipients = await fanOut(targetDepts, prefColumn, sender, {
      title,
      body,
      url: `/app`,
      tag: `room-${data.roomNumber}-${data.kind}`,
    });
    return { ok: true, recipients };
  });

export type MessagesDepartment = "housekeeping" | "reception" | "fnb" | "maintenance";
type MessagesThread =
  | "hk_reception"
  | "hk_fnb"
  | "reception_fnb"
  | "hk_maintenance"
  | "reception_maintenance"
  | "fnb_maintenance";

const THREAD_PAIR: Record<MessagesThread, [MessagesDepartment, MessagesDepartment]> = {
  hk_reception: ["housekeeping", "reception"],
  hk_fnb: ["housekeeping", "fnb"],
  reception_fnb: ["reception", "fnb"],
  hk_maintenance: ["housekeeping", "maintenance"],
  reception_maintenance: ["reception", "maintenance"],
  fnb_maintenance: ["fnb", "maintenance"],
};

const PREF_COL_FROM: Record<MessagesDepartment, keyof NotificationPrefs> = {
  reception: "notify_from_reception",
  housekeeping: "notify_from_housekeeping",
  fnb: "notify_from_fnb",
  maintenance: "notify_from_maintenance",
};

const DEPT_LABEL: Record<MessagesDepartment, string> = {
  housekeeping: "Housekeeping",
  reception: "Reception",
  fnb: "F&B",
  maintenance: "Maintenance",
};

export const notifyDepartmentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      thread: MessagesThread;
      senderDepartment: MessagesDepartment | null;
      message: string;
      roomNumber?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const sender = await getActor(context);
    if (!sender.active) return { ok: true, recipients: 0 };
    const pair = THREAD_PAIR[data.thread];
    if (!pair) throw new Error("Unknown thread");

    // Determine which side is the sender; the other side receives.
    // If the client couldn't say (admin/manager on both sides), notify both
    // halves and filter each by whether they opted in to the opposite half.
    const pairs: Array<{ from: MessagesDepartment; to: MessagesDepartment }> = [];
    const claimed = data.senderDepartment && pair.includes(data.senderDepartment)
      ? data.senderDepartment
      : // Fall back to the sender's own department memberships when the client
        // couldn't decide which half of the thread they sent from.
        pair.find((d) => sender.depts.includes(d as Dept)) ?? null;
    if (claimed) {
      const to = pair[0] === claimed ? pair[1] : pair[0];
      pairs.push({ from: claimed, to });
    } else {
      pairs.push({ from: pair[0], to: pair[1] });
      pairs.push({ from: pair[1], to: pair[0] });
    }

    const roomTag = typeof data.roomNumber === "number" ? ` — Room ${data.roomNumber}` : "";
    const body = data.message?.slice(0, 240) || "New message";

    let totalSubs = 0;
    for (const { from, to } of pairs) {
      totalSubs += await fanOut([to as Dept], PREF_COL_FROM[from], sender, {
        title: `${DEPT_LABEL[from]} — ${sender.username}${roomTag}`,
        body,
        url: `/app`,
        tag: `dept-${data.thread}-${from}`,
      });
    }

    return { ok: true, recipients: totalSubs };
  });

export const notifyMaintenanceRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      roomNumber: number | null;
      areaLabel?: string | null;
      message: string;
      originDepartment?: "housekeeping" | "reception" | "fnb" | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const sender = await getActor(context);
    if (!sender.active) return { ok: true, recipients: 0 };
    const fromLabel = data.originDepartment
      ? DEPT_LABEL[data.originDepartment]
      : sender.username;
    const body = (data.message?.slice(0, 240) || "New maintenance request");
    const place =
      data.roomNumber != null ? `Room ${data.roomNumber}` : (data.areaLabel || "Hotel");
    const recipients = await fanOut(
      ["maintenance"],
      "notify_maintenance_requests",
      sender,
      {
        title: `Maintenance — ${place} (${fromLabel})`,
        body,
        url: `/app`,
        tag: `maintenance-${data.roomNumber ?? data.areaLabel ?? "hotel"}`,
      },
    );
    return { ok: true, recipients };
  });