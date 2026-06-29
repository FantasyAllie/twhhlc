import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "admin" | "user" | "reception" | "pending";
export type ApprovedRole = "admin" | "user" | "reception";
export type SessionUser = { id: string; username: string; email: string; role: AppRole };
export type AppUserRow = {
  id: string;
  username: string;
  email: string;
  role: AppRole;
  created_at: string;
};

function validateRole(r: string): ApprovedRole {
  if (r !== "admin" && r !== "user" && r !== "reception") throw new Error("Invalid role");
  return r;
}
function validatePassword(p: string) {
  if (typeof p !== "string" || p.length < 6 || p.length > 128) {
    throw new Error("Password must be 6-128 characters");
  }
}

async function assertAdmin(ctx: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Admin access required");
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
    const roleMap = new Map<string, AppRole>();
    const priority: Record<AppRole, number> = { admin: 3, reception: 2, user: 1, pending: 0 };
    for (const r of (roleRows ?? []) as { user_id: string; role: AppRole }[]) {
      const cur = roleMap.get(r.user_id);
      if (!cur || priority[r.role] > priority[cur]) roleMap.set(r.user_id, r.role);
    }
    return ((profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null; created_at: string }>).map((p) => ({
      id: p.id,
      email: p.email ?? "",
      username: p.display_name || (p.email ?? "").split("@")[0] || "user",
      role: roleMap.get(p.id) ?? "pending",
      created_at: p.created_at,
    }));
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; role: ApprovedRole }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const role = validateRole(data.role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Prevent demoting the last admin if it's the actor themselves.
    if (role !== "admin") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1 && context.userId === data.id) {
        throw new Error("Cannot demote the only remaining admin");
      }
    }
    // Replace role rows for this user with the single chosen role.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.id, role });
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
  .inputValidator((d: { email: string; password: string; displayName?: string; role: ApprovedRole }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const role = validateRole(data.role);
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
    // Trigger inserted role 'pending' (or admin if magic email). Override to chosen role.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role });
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