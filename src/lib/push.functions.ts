import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "user" | "reception";
type AppRole = Role | "pending";

async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getActor(ctx: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const db = await getDb();
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    db.from("profiles").select("display_name, email").eq("id", ctx.userId).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", ctx.userId),
  ]);
  const roles = ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role);
  const order: AppRole[] = ["admin", "reception", "user", "pending"];
  let role: AppRole = "pending";
  for (const r of order) if (roles.includes(r)) { role = r; break; }
  const p = profile as { display_name: string | null; email: string | null } | null;
  const username = p?.display_name || (p?.email ?? "").split("@")[0] || "user";
  return { id: ctx.userId, username, role };
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

export type NotificationPrefs = {
  messages_enabled: boolean;
  checkout_enabled: boolean;
  done_enabled: boolean;
  notify_from_reception: boolean;
  notify_from_housekeeping: boolean;
  notify_from_fnb: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  messages_enabled: true,
  checkout_enabled: true,
  done_enabled: true,
  notify_from_reception: true,
  notify_from_housekeeping: true,
  notify_from_fnb: true,
};

export const getNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPrefs> => {
    const db = await getDb();
    const { data: row } = await db
      .from("notification_preferences" as never)
      .select("messages_enabled,checkout_enabled,done_enabled,notify_from_reception,notify_from_housekeeping,notify_from_fnb")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(row as Partial<NotificationPrefs>) };
  });

export const setNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      messages_enabled?: boolean;
      checkout_enabled?: boolean;
      done_enabled?: boolean;
      notify_from_reception?: boolean;
      notify_from_housekeeping?: boolean;
      notify_from_fnb?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const db = await getDb();
    const patch: Record<string, unknown> = { user_id: context.userId };
    if (typeof data.messages_enabled === "boolean") patch.messages_enabled = data.messages_enabled;
    if (typeof data.checkout_enabled === "boolean") patch.checkout_enabled = data.checkout_enabled;
    if (typeof data.done_enabled === "boolean") patch.done_enabled = data.done_enabled;
    if (typeof data.notify_from_reception === "boolean") patch.notify_from_reception = data.notify_from_reception;
    if (typeof data.notify_from_housekeeping === "boolean") patch.notify_from_housekeeping = data.notify_from_housekeeping;
    if (typeof data.notify_from_fnb === "boolean") patch.notify_from_fnb = data.notify_from_fnb;
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await getDb();
    const { data: rows } = await db
      .from("push_subscriptions" as never)
      .select("id,user_id,endpoint,p256dh,auth")
      .eq("user_id", context.userId);
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
    if (sender.role === "pending") return { ok: true, recipients: 0 };
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

    // 1) Find users in target roles, excluding the sender, from user_roles.
    const { data: usersRows, error: usersErr } = await db
      .from("user_roles")
      .select("user_id")
      .in("role", targetRoles)
      .neq("user_id", sender.id);
    if (usersErr) throw new Error(usersErr.message);
    const userIds = Array.from(
      new Set(((usersRows ?? []) as { user_id: string }[]).map((r) => r.user_id)),
    );
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

export type MessagesDepartment = "housekeeping" | "reception" | "fnb";
type MessagesThread = "hk_reception" | "hk_fnb" | "reception_fnb";

const THREAD_PAIR: Record<MessagesThread, [MessagesDepartment, MessagesDepartment]> = {
  hk_reception: ["housekeeping", "reception"],
  hk_fnb: ["housekeeping", "fnb"],
  reception_fnb: ["reception", "fnb"],
};

const DEPT_TO_ROLES: Record<MessagesDepartment, Role[]> = {
  housekeeping: ["user", "admin"],
  reception: ["reception", "admin"],
  // "fnb" is stored in user_roles as a separate role name.
  fnb: ["fnb" as Role, "admin"],
};

const PREF_COL_FROM: Record<MessagesDepartment, keyof NotificationPrefs> = {
  reception: "notify_from_reception",
  housekeeping: "notify_from_housekeeping",
  fnb: "notify_from_fnb",
};

const DEPT_LABEL: Record<MessagesDepartment, string> = {
  housekeeping: "Housekeeping",
  reception: "Reception",
  fnb: "F&B",
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
    if (sender.role === "pending") return { ok: true, recipients: 0 };
    const db = await getDb();
    const pair = THREAD_PAIR[data.thread];
    if (!pair) throw new Error("Unknown thread");

    // Determine which side is the sender; the other side receives.
    // If the client couldn't say (admin/manager on both sides), notify both
    // halves and filter each by whether they opted in to the opposite half.
    const pairs: Array<{ from: MessagesDepartment; to: MessagesDepartment }> = [];
    if (data.senderDepartment && pair.includes(data.senderDepartment)) {
      const to = pair[0] === data.senderDepartment ? pair[1] : pair[0];
      pairs.push({ from: data.senderDepartment, to });
    } else {
      pairs.push({ from: pair[0], to: pair[1] });
      pairs.push({ from: pair[1], to: pair[0] });
    }

    const roomTag = typeof data.roomNumber === "number" ? ` — Room ${data.roomNumber}` : "";
    const body = data.message?.slice(0, 240) || "New message";

    let totalSubs = 0;
    for (const { from, to } of pairs) {
      const roles = DEPT_TO_ROLES[to];
      const { data: usersRows } = await db
        .from("user_roles")
        .select("user_id")
        .in("role", roles)
        .neq("user_id", sender.id);
      const userIds = Array.from(
        new Set(((usersRows ?? []) as { user_id: string }[]).map((r) => r.user_id)),
      );
      if (userIds.length === 0) continue;

      const prefCol = PREF_COL_FROM[from];
      const { data: prefsRows } = await db
        .from("notification_preferences" as never)
        .select(`user_id,${prefCol}`)
        .in("user_id", userIds);
      const disabled = new Set<string>();
      for (const p of (prefsRows ?? []) as Array<Record<string, unknown>>) {
        if (p[prefCol] === false) disabled.add(p.user_id as string);
      }
      const optedIn = userIds.filter((id) => !disabled.has(id));
      if (optedIn.length === 0) continue;

      const { data: subRows } = await db
        .from("push_subscriptions" as never)
        .select("id,user_id,endpoint,p256dh,auth")
        .in("user_id", optedIn);
      const subs = (subRows ?? []) as SubRow[];
      totalSubs += subs.length;
      await sendToSubs(subs, {
        title: `${DEPT_LABEL[from]} — ${sender.username}${roomTag}`,
        body,
        url: `/app`,
        tag: `dept-${data.thread}-${from}`,
      });
    }

    return { ok: true, recipients: totalSubs };
  });