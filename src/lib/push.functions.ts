import { createServerFn } from "@tanstack/react-start";

type Role = "admin" | "user" | "reception";
type TokenPayload = { sub: string; username: string; role: Role; exp: number };

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlToString(s: string): string {
  return new TextDecoder().decode(b64urlToBytes(s));
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const [h, b, s] = token.split(".");
    if (!h || !b || !s) return null;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret) as unknown as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(s) as unknown as ArrayBuffer,
      enc.encode(`${h}.${b}`) as unknown as ArrayBuffer,
    );
    if (!ok) return null;
    const payload = JSON.parse(b64urlToString(b)) as TokenPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function requireUser(token: string): Promise<TokenPayload> {
  const p = await verifyToken(token);
  if (!p) throw new Error("Not authenticated");
  return p;
}

async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
});

export const subscribeToPush = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { token: string; endpoint: string; p256dh: string; auth: string; userAgent?: string }) => d,
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.token);
    if (!data.endpoint || !data.p256dh || !data.auth) throw new Error("Invalid subscription");
    const db = await getDb();
    const { error } = await db
      .from("push_subscriptions" as never)
      .upsert(
        {
          user_id: user.sub,
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
  .inputValidator((d: { token: string; endpoint: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser(data.token);
    const db = await getDb();
    const { error } = await db
      .from("push_subscriptions" as never)
      .delete()
      .eq("user_id", user.sub)
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type NotificationPrefs = {
  messages_enabled: boolean;
  checkout_enabled: boolean;
  done_enabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  messages_enabled: true,
  checkout_enabled: true,
  done_enabled: true,
};

export const getNotificationPrefs = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }): Promise<NotificationPrefs> => {
    const user = await requireUser(data.token);
    const db = await getDb();
    const { data: row } = await db
      .from("notification_preferences" as never)
      .select("messages_enabled,checkout_enabled,done_enabled")
      .eq("user_id", user.sub)
      .maybeSingle();
    return (row as NotificationPrefs | null) ?? DEFAULT_PREFS;
  });

export const setNotificationPrefs = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      token: string;
      messages_enabled?: boolean;
      checkout_enabled?: boolean;
      done_enabled?: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.token);
    const db = await getDb();
    const patch: Record<string, unknown> = { user_id: user.sub };
    if (typeof data.messages_enabled === "boolean") patch.messages_enabled = data.messages_enabled;
    if (typeof data.checkout_enabled === "boolean") patch.checkout_enabled = data.checkout_enabled;
    if (typeof data.done_enabled === "boolean") patch.done_enabled = data.done_enabled;
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
  const failed = results.filter((r) => !r.ok && !r.gone);
  if (failed.length > 0) {
    console.warn("push delivery failures", failed.map((f) => ({ status: f.status, err: f.error })));
  }
}

export const sendTestNotification = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser(data.token);
    const db = await getDb();
    const { data: rows } = await db
      .from("push_subscriptions" as never)
      .select("id,user_id,endpoint,p256dh,auth")
      .eq("user_id", user.sub);
    const subs = (rows ?? []) as SubRow[];
    await sendToSubs(subs, {
      title: "TW Housekeeping — Test notification",
      body: "If you can see this, push notifications are working on this device.",
      url: "/app",
    });
    return { ok: true, sent: subs.length };
  });

export type RoomEventKind = "message" | "checkout" | "done";

export const notifyRoomEvent = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      token: string;
      kind: RoomEventKind;
      roomNumber: number;
      messageText?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const sender = await requireUser(data.token);
    const db = await getDb();

    // Pick target roles + which preference column to require.
    let targetRoles: Role[];
    let prefColumn: keyof NotificationPrefs;
    let title: string;
    let body: string;
    switch (data.kind) {
      case "message":
        // Reception sends -> housekeeping receives; housekeeping sends -> reception receives.
        targetRoles =
          sender.role === "reception" ? ["user", "admin"] : ["reception"];
        prefColumn = "messages_enabled";
        title = `Room ${data.roomNumber} — Message from ${sender.username}`;
        body = data.messageText?.slice(0, 240) ?? "New message";
        break;
      case "checkout":
        targetRoles = ["user", "admin"];
        prefColumn = "checkout_enabled";
        title = `Room ${data.roomNumber} — Guest checked out`;
        body = `Reception (${sender.username}) marked room ${data.roomNumber} as checked out.`;
        break;
      case "done":
        targetRoles = ["reception", "admin"];
        prefColumn = "done_enabled";
        title = `Room ${data.roomNumber} — Marked done`;
        body = `Housekeeping (${sender.username}) marked room ${data.roomNumber} as done.`;
        break;
      default:
        throw new Error("Unknown event kind");
    }

    // 1) Find users in target roles, excluding the sender.
    const { data: usersRows, error: usersErr } = await db
      .from("app_users")
      .select("id")
      .in("role", targetRoles)
      .neq("id", sender.sub);
    if (usersErr) throw new Error(usersErr.message);
    const userIds = ((usersRows ?? []) as { id: string }[]).map((r) => r.id);
    if (userIds.length === 0) return { ok: true, recipients: 0 };

    // 2) Filter to users whose preference is enabled (or who have no row → default true).
    const { data: prefsRows } = await db
      .from("notification_preferences" as never)
      .select(`user_id,${prefColumn}`)
      .in("user_id", userIds);
    const prefsMap = new Map<string, boolean>();
    for (const p of (prefsRows ?? []) as Array<Record<string, unknown>>) {
      prefsMap.set(p.user_id as string, p[prefColumn] !== false);
    }
    const optedIn = userIds.filter((id) => prefsMap.get(id) !== false);
    if (optedIn.length === 0) return { ok: true, recipients: 0 };

    // 3) Load subscriptions for those users.
    const { data: subRows } = await db
      .from("push_subscriptions" as never)
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", optedIn);
    const subs = (subRows ?? []) as SubRow[];

    await sendToSubs(subs, {
      title,
      body,
      url: `/app`,
      tag: `room-${data.roomNumber}-${data.kind}`,
    });

    return { ok: true, recipients: subs.length };
  });