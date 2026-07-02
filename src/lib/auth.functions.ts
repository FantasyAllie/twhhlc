import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// A user has exactly one Position and zero or more Sub-roles.
// Positions live alongside sub-role rows in public.user_roles.
export type Position = "admin" | "manager" | "user" | "pending";
export type SubRole = "reception" | "housekeeper" | "fnb";
// Compat role used by legacy UI paths — derived from position + sub-roles.
export type AppRole = "admin" | "manager" | "user" | "reception" | "fnb" | "pending";
export type SessionUser = {
  id: string;
  username: string;
  email: string;
  position: Position;
  subRoles: SubRole[];
  /** Back-compat: rough single-role summary. Prefer position/subRoles. */
  role: AppRole;
};
export type AppUserRow = {
  id: string;
  username: string;
  email: string;
  position: Position;
  subRoles: SubRole[];
  created_at: string;
  disabled: boolean;
};

const POSITIONS: ReadonlyArray<Position> = ["admin", "manager", "user", "pending"];
const SUB_ROLES: ReadonlyArray<SubRole> = ["reception", "housekeeper", "fnb"];

function validatePosition(p: string): Exclude<Position, "pending"> {
  if (p !== "admin" && p !== "manager" && p !== "user") throw new Error("Invalid position");
  return p;
}
function validateSubRoles(rs: unknown): SubRole[] {
  if (!Array.isArray(rs)) throw new Error("Invalid sub-roles");
  const out: SubRole[] = [];
  for (const r of rs) {
    if (r === "reception" || r === "housekeeper" || r === "fnb") {
      if (!out.includes(r)) out.push(r);
    } else {
      throw new Error("Invalid sub-role");
    }
  }
  return out;
}
function validatePassword(p: string) {
  if (typeof p !== "string" || p.length < 6 || p.length > 128) {
    throw new Error("Password must be 6-128 characters");
  }
}

async function assertAdmin(ctx: { userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Admin access required");
}

function splitRoles(rows: Array<{ role: string }>): { position: Position; subRoles: SubRole[] } {
  let position: Position = "pending";
  const subRoles: SubRole[] = [];
  const priority: Record<Position, number> = { admin: 4, manager: 3, user: 2, pending: 1 };
  for (const r of rows) {
    if (r.role === "reception" || r.role === "housekeeper" || r.role === "fnb") {
      if (!subRoles.includes(r.role)) subRoles.push(r.role);
    } else if ((POSITIONS as ReadonlyArray<string>).includes(r.role)) {
      const p = r.role as Position;
      if (priority[p] > priority[position]) position = p;
    }
  }
  return { position, subRoles };
}

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUserRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    const rowsByUser = new Map<string, Array<{ role: string }>>();
    for (const r of (roleRows ?? []) as { user_id: string; role: string }[]) {
      const list = rowsByUser.get(r.user_id) ?? [];
      list.push({ role: r.role });
      rowsByUser.set(r.user_id, list);
    }
    // Pull ban status from auth.users in one paged listing
    const disabledMap = new Map<string, boolean>();
    try {
      let page = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error: lerr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (lerr) break;
        const users = data?.users ?? [];
        for (const u of users) {
          const bu = (u as { banned_until?: string | null }).banned_until ?? null;
          disabledMap.set(u.id, !!bu && new Date(bu).getTime() > Date.now());
        }
        if (users.length < 200) break;
        page += 1;
      }
    } catch {
      // best-effort: leave disabledMap empty
    }
    return ((profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null; created_at: string }>).map((p) => {
      const { position, subRoles } = splitRoles(rowsByUser.get(p.id) ?? []);
      return {
        id: p.id,
        email: p.email ?? "",
        username: p.display_name || (p.email ?? "").split("@")[0] || "user",
        position,
        subRoles,
        created_at: p.created_at,
        disabled: disabledMap.get(p.id) ?? false,
      };
    });
  });

/**
 * Replace a user's entire (position + sub-role) assignment in one shot.
 * Guards against demoting the last admin (self) and against invalid inputs.
 */
export const updateUserAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; position: "admin" | "manager" | "user"; subRoles: SubRole[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const position = validatePosition(data.position);
    const subRoles = validateSubRoles(data.subRoles);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (position !== "admin") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1 && context.userId === data.id) {
        throw new Error("Cannot demote the only remaining admin");
      }
    }
    // Rewrite all role rows for this user.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const insertRows = [
      { user_id: data.id, role: position },
      ...subRoles.map((r) => ({ user_id: data.id, role: r })),
    ];
    const { error } = await supabaseAdmin.from("user_roles").insert(insertRows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (context.userId === data.id) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; displayName?: string; position: "admin" | "manager" | "user"; subRoles: SubRole[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const position = validatePosition(data.position);
    const subRoles = validateSubRoles(data.subRoles);
    validatePassword(data.password);
    const email = String(data.email).trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Valid email is required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.displayName ? { display_name: data.displayName } : {},
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
    // Trigger inserted role 'pending' (or admin if magic email). Override.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin.from("user_roles").insert([
      { user_id: created.user.id, role: position },
      ...subRoles.map((r) => ({ user_id: created.user.id, role: r })),
    ]);
    return { ok: true };
  });

export const updateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; password: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    validatePassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; disabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (context.userId === data.id && data.disabled) {
      throw new Error("You cannot disable your own account");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // "none" lifts the ban; a long duration disables sign-in and revokes sessions.
    const ban_duration = data.disabled ? "876000h" : "none";
    const { error } = await (supabaseAdmin.auth.admin.updateUserById(
      data.id,
      { ban_duration } as unknown as Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1],
    ));
    if (error) throw new Error(error.message);
    return { ok: true };
  });