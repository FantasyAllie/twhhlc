import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// A user has exactly one Position and zero or more Sub-roles.
// Positions live alongside sub-role rows in public.user_roles.
export type Position = "developer" | "regional_admin" | "admin" | "manager" | "user" | "pending";
export type SubRole = "reception" | "housekeeper" | "fnb" | "maintenance";
// Compat role used by legacy UI paths — derived from position + sub-roles.
export type AppRole = "developer" | "regional_admin" | "admin" | "manager" | "user" | "reception" | "fnb" | "maintenance" | "pending";
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
  /** All hotels this user can log into. */
  hotelIds: string[];
  hotelNames: string[];
  created_at: string;
  disabled: boolean;
};
export type HotelOption = { id: string; name: string; slug: string };

const POSITIONS: ReadonlyArray<Position> = ["developer", "regional_admin", "admin", "manager", "user", "pending"];
const SUB_ROLES: ReadonlyArray<SubRole> = ["reception", "housekeeper", "fnb", "maintenance"];

function validatePosition(p: string): Exclude<Position, "pending"> {
  if (p !== "developer" && p !== "regional_admin" && p !== "admin" && p !== "manager" && p !== "user") throw new Error("Invalid position");
  return p;
}
function validateSubRoles(rs: unknown): SubRole[] {
  if (!Array.isArray(rs)) throw new Error("Invalid sub-roles");
  const out: SubRole[] = [];
  for (const r of rs) {
    if (r === "reception" || r === "housekeeper" || r === "fnb" || r === "maintenance") {
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

async function getAdminAccess(ctx: { userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", ["developer", "admin", "regional_admin", "manager"]);
  if (error) throw new Error(error.message);
  const roleList = ((roles ?? []) as { role: string }[]).map((r) => r.role);
  const isDeveloper = roleList.includes("developer");
  // Developers get full admin capabilities; treat as super admin everywhere.
  const isSuperAdmin = roleList.includes("admin") || isDeveloper;
  const isRegionalManager = roleList.includes("regional_admin");
  const isManagerOnly = !isSuperAdmin && !isRegionalManager && roleList.includes("manager");
  if (!isSuperAdmin && !isRegionalManager && !isManagerOnly) {
    throw new Error("Admin, regional manager or manager access required");
  }
  // Cross-hotel visibility (see every hotel) is for the top two tiers only.
  const isCrossHotel = isSuperAdmin || isRegionalManager;
  // Kept for back-compat with existing call sites reading `isRegionalAdmin`.
  const isRegionalAdmin = isCrossHotel;

  const { data: active } = await supabaseAdmin
    .from("user_active_hotel")
    .select("hotel_id")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  return {
    supabaseAdmin,
    isSuperAdmin,
    isDeveloper,
    isRegionalManager,
    isManagerOnly,
    isCrossHotel,
    isRegionalAdmin,
    activeHotelId: (active as { hotel_id: string } | null)?.hotel_id ?? null,
  };
}

/** Enforce the "who can assign which position" ladder. */
function assertCanAssignPosition(
  caller: { isSuperAdmin: boolean; isDeveloper: boolean; isRegionalManager: boolean; isManagerOnly: boolean },
  target: Exclude<Position, "pending">,
) {
  // Only developers can mint another developer.
  if (target === "developer") {
    if (caller.isDeveloper) return;
    throw new Error("Only developers can assign the developer position");
  }
  if (caller.isSuperAdmin) return; // admin/developer can assign anything else
  if (caller.isRegionalManager) {
    if (target === "admin") throw new Error("Only admins can assign the admin position");
    return; // regional_admin/manager/user OK
  }
  if (caller.isManagerOnly) {
    if (target !== "user") throw new Error("Managers can only add users");
    return;
  }
  throw new Error("Insufficient permissions");
}

async function assertAdmin(ctx: { userId: string }) {
  const acc = await getAdminAccess(ctx);
  if (!acc.isSuperAdmin && !acc.isRegionalManager) {
    throw new Error("Admin or regional manager access required");
  }
}

async function assertAdminOrManager(ctx: { userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", ["developer", "admin", "regional_admin", "manager"]);
  if (error || !data || data.length === 0) throw new Error("Admin or manager access required");
}

function splitRoles(rows: Array<{ role: string }>): { position: Position; subRoles: SubRole[] } {
  let position: Position = "pending";
  const subRoles: SubRole[] = [];
  const priority: Record<Position, number> = { developer: 6, admin: 5, regional_admin: 4, manager: 3, user: 2, pending: 1 };
  for (const r of rows) {
    if (r.role === "reception" || r.role === "housekeeper" || r.role === "fnb" || r.role === "maintenance") {
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
    const { supabaseAdmin, isRegionalAdmin, activeHotelId } = await getAdminAccess(context);

    const membershipQuery = supabaseAdmin
      .from("hotel_members")
      .select("user_id, hotel_id, hotels ( id, name, slug )");
    // Regional admins see all memberships across every hotel. Non-regional
    // admins are scoped to their currently active hotel — they only see users
    // who belong to that same hotel.
    const { data: memberships, error: mErr } = isRegionalAdmin
      ? await membershipQuery
      : activeHotelId
      ? await membershipQuery.eq("hotel_id", activeHotelId)
      : { data: [], error: null };
    if (mErr) throw new Error(mErr.message);

    const membershipRows = (memberships ?? []) as Array<{
      user_id: string;
      hotel_id: string;
      hotels: { id: string; name: string; slug: string } | null;
    }>;
    const membershipsByUser = new Map<string, { ids: string[]; names: string[] }>();
    for (const row of membershipRows) {
      const entry = membershipsByUser.get(row.user_id) ?? { ids: [], names: [] };
      entry.ids.push(row.hotel_id);
      entry.names.push(row.hotels?.name ?? "Unknown");
      membershipsByUser.set(row.user_id, entry);
    }

    const profileQuery = supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, created_at")
      .order("created_at", { ascending: true });
    const scopedIds = Array.from(membershipsByUser.keys());
    const { data: profiles, error } = isRegionalAdmin
      ? await profileQuery
      : scopedIds.length > 0
      ? await profileQuery.in("id", scopedIds)
      : { data: [], error: null };
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
      const m = membershipsByUser.get(p.id);
      return {
        id: p.id,
        email: p.email ?? "",
        username: p.display_name || (p.email ?? "").split("@")[0] || "user",
        position,
        subRoles,
        hotelIds: m?.ids ?? [],
        hotelNames: m?.names ?? [],
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
  .inputValidator((d: { id: string; position: Exclude<Position, "pending">; subRoles: SubRole[]; hotelIds?: string[] }) => d)
  .handler(async ({ data, context }) => {
    const access = await getAdminAccess(context);
    const { supabaseAdmin, isRegionalAdmin, activeHotelId } = access;
    const position = validatePosition(data.position);
    const subRoles = validateSubRoles(data.subRoles);
    assertCanAssignPosition(access, position);

    // Non-regional admins may only manage users who are members of their
    // currently active hotel, and may only (re)assign that same hotel.
    let nextHotelIds: string[] | undefined = data.hotelIds
      ? Array.from(new Set(data.hotelIds.filter(Boolean)))
      : undefined;
    if (!isRegionalAdmin) {
      if (!activeHotelId) throw new Error("Pick a hotel workspace first");
      const { data: targetMemberships } = await supabaseAdmin
        .from("hotel_members")
        .select("hotel_id")
        .eq("user_id", data.id);
      const targetHotelIds = ((targetMemberships ?? []) as { hotel_id: string }[]).map((r) => r.hotel_id);
      if (!targetHotelIds.includes(activeHotelId)) {
        throw new Error("You can only manage users in your active hotel");
      }
      if (nextHotelIds && nextHotelIds.some((h) => h !== activeHotelId)) {
        throw new Error("You can only assign your active hotel");
      }
      if (!nextHotelIds) nextHotelIds = [activeHotelId];
    }

    if (position !== "admin" && position !== "regional_admin") {
      const { data: adminRows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "regional_admin"]);
      const adminUserCount = new Set(((adminRows ?? []) as { user_id: string }[]).map((r) => r.user_id)).size;
      if (adminUserCount <= 1 && context.userId === data.id) {
        throw new Error("Cannot demote the only remaining admin");
      }
    }

    // Replace the user's full hotel membership set when a list was provided.
    if (nextHotelIds) {
      if (nextHotelIds.length === 0) throw new Error("Assign at least one hotel");
      const { data: hotels, error: hErr } = await supabaseAdmin
        .from("hotels")
        .select("id")
        .in("id", nextHotelIds);
      if (hErr) throw new Error(hErr.message);
      const validIds = new Set(((hotels ?? []) as { id: string }[]).map((h) => h.id));
      if (validIds.size !== nextHotelIds.length) throw new Error("Hotel not found");

      await supabaseAdmin.from("hotel_members").delete().eq("user_id", data.id);
      await supabaseAdmin
        .from("hotel_members")
        .insert(nextHotelIds.map((h) => ({ user_id: data.id, hotel_id: h })));

      // Ensure the user's active hotel is still one they can access. If not,
      // clear it so they must pick again next sign-in.
      const { data: active } = await supabaseAdmin
        .from("user_active_hotel")
        .select("hotel_id")
        .eq("user_id", data.id)
        .maybeSingle();
      const activeId = (active as { hotel_id: string } | null)?.hotel_id ?? null;
      if (!activeId || !nextHotelIds.includes(activeId)) {
        await supabaseAdmin.from("user_active_hotel").delete().eq("user_id", data.id);
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
  .inputValidator((d: { email: string; password: string; displayName?: string; position: Exclude<Position, "pending">; subRoles: SubRole[]; hotelIds?: string[] }) => d)
  .handler(async ({ data, context }) => {
    const access = await getAdminAccess(context);
    const { supabaseAdmin, isRegionalAdmin, activeHotelId } = access;
    const position = validatePosition(data.position);
    const subRoles = validateSubRoles(data.subRoles);
    assertCanAssignPosition(access, position);
    validatePassword(data.password);
    const email = String(data.email).trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Valid email is required");
    const requested = Array.from(new Set((data.hotelIds ?? []).filter(Boolean)));
    const hotelIds = isRegionalAdmin
      ? requested
      : activeHotelId
      ? [activeHotelId]
      : [];
    if (hotelIds.length === 0) throw new Error("Choose at least one hotel for this user");
    if (!isRegionalAdmin && requested.some((h) => h !== activeHotelId)) {
      throw new Error("You can only assign your active hotel");
    }
    const { data: hotels, error: hErr } = await supabaseAdmin
      .from("hotels")
      .select("id")
      .in("id", hotelIds);
    if (hErr) throw new Error(hErr.message);
    if (((hotels ?? []) as { id: string }[]).length !== hotelIds.length) {
      throw new Error("Hotel not found");
    }
    const primaryHotel = hotelIds[0];
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { ...(data.displayName ? { display_name: data.displayName } : {}), hotel_id: primaryHotel },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin.from("user_roles").insert([
      { user_id: created.user.id, role: position },
      ...subRoles.map((r) => ({ user_id: created.user.id, role: r })),
    ]);
    await supabaseAdmin.from("hotel_members").delete().eq("user_id", created.user.id);
    await supabaseAdmin
      .from("hotel_members")
      .insert(hotelIds.map((h) => ({ user_id: created.user.id, hotel_id: h })));
    // If the user has exactly one hotel, seed their active hotel so they land
    // straight in the workspace without needing to pick.
    if (hotelIds.length === 1) {
      await supabaseAdmin
        .from("user_active_hotel")
        .upsert({ user_id: created.user.id, hotel_id: hotelIds[0] }, { onConflict: "user_id" });
    } else {
      await supabaseAdmin.from("user_active_hotel").delete().eq("user_id", created.user.id);
    }
    return { ok: true };
  });

export const listHotels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HotelOption[]> => {
    const { supabaseAdmin, isRegionalAdmin, isDeveloper, activeHotelId } = await getAdminAccess(context);
    const base = supabaseAdmin
      .from("hotels")
      .select("id, name, slug")
      .order("name", { ascending: true });
    // Developer-only test hotels never appear to anyone else.
    const query = isDeveloper ? base : (base as any).eq("developer_only", false) as typeof base;
    const { data, error } = isRegionalAdmin
      ? await query
      : activeHotelId
      ? await query.eq("id", activeHotelId)
      : { data: [], error: null };
    if (error) throw new Error(error.message);
    return ((data ?? []) as HotelOption[]).map((h) => ({ id: h.id, name: h.name, slug: h.slug }));
  });

/**
 * The hotels the current signed-in user personally belongs to. Used by the
 * login page workspace picker — available to every authenticated user, not
 * only admins.
 */
export const listMyHotels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HotelOption[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    const isRegionalAdmin = roles.includes("regional_admin");
    if (isRegionalAdmin) {
      const base = supabaseAdmin
        .from("hotels")
        .select("id, name, slug")
        .order("name", { ascending: true });
      const { data, error } = roles.includes("developer") ? await base : await (base as any).eq("developer_only", false);
      if (error) throw new Error(error.message);
      return ((data ?? []) as HotelOption[]).map((h) => ({ id: h.id, name: h.name, slug: h.slug }));
    }
    const { data, error } = await supabaseAdmin
      .from("hotel_members")
      .select("hotels ( id, name, slug )")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ hotels: { id: string; name: string; slug: string } | null }>;
    return rows
      .map((r) => r.hotels)
      .filter((h): h is { id: string; name: string; slug: string } => !!h)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

export const createHotel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data, context }): Promise<HotelOption> => {
    const { supabaseAdmin, isCrossHotel } = await getAdminAccess(context);
    if (!isCrossHotel) throw new Error("Only admins or regional managers can create hotels");
    const name = String(data.name ?? "").trim();
    if (name.length < 2 || name.length > 80) throw new Error("Hotel name must be 2-80 characters");
    const baseSlug = name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hotel";
    let slug = baseSlug;
    for (let i = 2; i < 100; i += 1) {
      const { data: existing } = await supabaseAdmin
        .from("hotels")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${i}`;
    }
    const { data: hotel, error } = await supabaseAdmin
      .from("hotels")
      .insert({ name, slug })
      .select("id, name, slug")
      .single();
    if (error) throw new Error(error.message);
    return hotel as HotelOption;
  });

export const setActiveHotel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hotelId: string }) => d)
  .handler(async ({ data, context }) => {
    // Any signed-in user may set their active hotel — but only to a hotel
    // they're actually a member of (regional admins can pick any hotel).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    const isRegionalAdmin = roles.includes("regional_admin");
    if (!isRegionalAdmin) {
      const { data: membership } = await supabaseAdmin
        .from("hotel_members")
        .select("hotel_id")
        .eq("user_id", context.userId)
        .eq("hotel_id", data.hotelId)
        .maybeSingle();
      if (!membership) throw new Error("You are not a member of that hotel");
    } else {
      const { data: hotel } = await supabaseAdmin
        .from("hotels")
        .select("id, developer_only")
        .eq("id", data.hotelId)
        .maybeSingle();
      if (!hotel || ((hotel as unknown as { developer_only?: boolean }).developer_only && !roles.includes("developer"))) throw new Error("Hotel not found");
    }
    const { error } = await supabaseAdmin
      .from("user_active_hotel")
      .upsert({ user_id: context.userId, hotel_id: data.hotelId }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHotel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hotelId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, isCrossHotel } = await getAdminAccess(context);
    if (!isCrossHotel) throw new Error("Only admins or regional managers can delete hotels");
    const { data: remaining } = await supabaseAdmin.from("hotels").select("id");
    if (((remaining ?? []) as { id: string }[]).length <= 1) {
      throw new Error("Cannot delete the last hotel workspace");
    }
    const { error } = await supabaseAdmin
      .from("hotels")
      .delete()
      .eq("id", data.hotelId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.storage.from("entry-photos").remove([`hotels/${data.hotelId}/wallpaper.jpg`]);
    return { ok: true };
  });

/** Where a hotel's wallpaper photo lives. Only the server reads or writes it. */
const WALLPAPER_BUCKET = "entry-photos";
const wallpaperPath = (hotelId: string) => `hotels/${hotelId}/wallpaper.jpg`;

/**
 * Sets or removes a hotel's wallpaper photo (the iPhone app shows it, blurred,
 * behind every screen). Admins and regional managers only, like creating or
 * deleting a hotel. `image` is a base64 JPEG, or null to remove the photo.
 */
export const setHotelWallpaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hotelId: string; image: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, isCrossHotel } = await getAdminAccess(context);
    if (!isCrossHotel) throw new Error("Only admins or regional managers can change a hotel's wallpaper");
    const { data: hotel } = await supabaseAdmin
      .from("hotels")
      .select("id")
      .eq("id", data.hotelId)
      .maybeSingle();
    if (!hotel) throw new Error("Hotel not found");
    const path = wallpaperPath(data.hotelId);
    if (data.image == null) {
      await supabaseAdmin.storage.from(WALLPAPER_BUCKET).remove([path]);
      return { ok: true };
    }
    if (typeof data.image !== "string" || data.image.length > 8_000_000) {
      throw new Error("That photo is too large");
    }
    const binary = atob(data.image);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const { error } = await supabaseAdmin.storage
      .from(WALLPAPER_BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * A short-lived link to a hotel's wallpaper photo, or null when it has none.
 * Anyone in that hotel may see it (regional admins can see any hotel's).
 */
export const getHotelWallpaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hotelId: string }) => d)
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.some((r) => ["regional_admin", "admin", "developer"].includes(r))) {
      const { data: membership } = await supabaseAdmin
        .from("hotel_members")
        .select("hotel_id")
        .eq("user_id", context.userId)
        .eq("hotel_id", data.hotelId)
        .maybeSingle();
      if (!membership) throw new Error("You are not a member of that hotel");
    }
    const { data: signed } = await supabaseAdmin.storage
      .from(WALLPAPER_BUCKET)
      .createSignedUrl(wallpaperPath(data.hotelId), 3600);
    return { url: signed?.signedUrl ?? null };
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

/** Pending-user row for the approval-only view (admin or manager). */
export type PendingUserRow = { id: string; username: string; email: string; created_at: string };

export const listPendingUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingUserRow[]> => {
    await assertAdminOrManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "pending");
    if (rErr) throw new Error(rErr.message);
    const ids = ((roleRows ?? []) as { user_id: string }[]).map((r) => r.user_id);
    if (ids.length === 0) return [];
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, created_at")
      .in("id", ids)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ((profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null; created_at: string }>).map((p) => ({
      id: p.id,
      email: p.email ?? "",
      username: p.display_name || (p.email ?? "").split("@")[0] || "user",
      created_at: p.created_at,
    }));
  });

/**
 * Approve a pending user by promoting them to position "user" with the chosen sub-role.
 * Callable by admins or managers. Only works on accounts currently in "pending".
 */
export const approvePendingUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      subRoles: SubRole[];
      position?: Exclude<Position, "pending">;
      hotelIds?: string[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const access = await getAdminAccess(context);
    const { supabaseAdmin, isRegionalAdmin, activeHotelId } = access;
    const subRoles = validateSubRoles(data.subRoles);
    if (subRoles.length === 0) throw new Error("Pick at least one department");
    const position: Exclude<Position, "pending"> = data.position
      ? validatePosition(data.position)
      : "user";
    assertCanAssignPosition(access, position);

    // Verify the target account is currently pending.
    const { data: existing, error: eErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.id);
    if (eErr) throw new Error(eErr.message);
    const roles = ((existing ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.includes("pending")) {
      throw new Error("This account is not pending approval");
    }

    // Scope hotel assignment: regional admins/developers may set any list;
    // everyone else is locked to their own active hotel.
    let nextHotelIds = Array.from(new Set((data.hotelIds ?? []).filter(Boolean)));
    if (!isRegionalAdmin) {
      if (!activeHotelId) throw new Error("Pick a hotel workspace first");
      if (nextHotelIds.length > 0 && nextHotelIds.some((h) => h !== activeHotelId)) {
        throw new Error("You can only assign your active hotel");
      }
      nextHotelIds = [activeHotelId];
    }
    if (nextHotelIds.length === 0) throw new Error("Assign at least one hotel");
    const { data: hotels, error: hErr } = await supabaseAdmin
      .from("hotels")
      .select("id")
      .in("id", nextHotelIds);
    if (hErr) throw new Error(hErr.message);
    if (((hotels ?? []) as { id: string }[]).length !== nextHotelIds.length) {
      throw new Error("Hotel not found");
    }

    await supabaseAdmin.from("hotel_members").delete().eq("user_id", data.id);
    await supabaseAdmin
      .from("hotel_members")
      .insert(nextHotelIds.map((h) => ({ user_id: data.id, hotel_id: h })));
    if (nextHotelIds.length === 1) {
      await supabaseAdmin
        .from("user_active_hotel")
        .upsert({ user_id: data.id, hotel_id: nextHotelIds[0] }, { onConflict: "user_id" });
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin.from("user_roles").insert([
      { user_id: data.id, role: position },
      ...subRoles.map((r) => ({ user_id: data.id, role: r })),
    ]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });