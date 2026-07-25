import { supabase } from "@/integrations/supabase/client";

export type AppRole = "developer" | "regional_admin" | "admin" | "manager" | "user" | "reception" | "fnb" | "maintenance" | "pending";
export type Position = "developer" | "regional_admin" | "admin" | "manager" | "user" | "pending";
export type SubRole = "reception" | "housekeeper" | "fnb" | "maintenance";
export type SessionUser = {
  id: string;
  username: string;
  email: string;
  position: Position;
  subRoles: SubRole[];
  /** Legacy compat single-role summary; prefer position/subRoles. */
  role: AppRole;
};

const USER_CACHE_KEY = "tw_session_user";

let cachedToken: string | null = null;
let cachedUser: SessionUser | null = null;
let bootstrapped = false;

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("tw-auth-changed"));
}

function loadCachedUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}
function storeCachedUser(u: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (u) window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
  else window.localStorage.removeItem(USER_CACHE_KEY);
}

async function fetchRoleRows(userId: string): Promise<{ position: Position; subRoles: SubRole[] }> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  const priority: Record<Position, number> = { developer: 6, admin: 5, regional_admin: 4, manager: 3, user: 2, pending: 1 };
  let position: Position = "pending";
  const subRoles: SubRole[] = [];
  for (const r of roles) {
    if (r === "reception" || r === "housekeeper" || r === "fnb" || r === "maintenance") {
      if (!subRoles.includes(r)) subRoles.push(r);
    } else if (r === "developer" || r === "regional_admin" || r === "admin" || r === "manager" || r === "user" || r === "pending") {
      if (priority[r] > priority[position]) position = r;
    }
  }
  return { position, subRoles };
}

function compatRole(position: Position, subRoles: SubRole[]): AppRole {
  if (position === "developer" || position === "regional_admin" || position === "admin" || position === "manager") return position;
  if (position === "pending") return "pending";
  // position === "user": pick sub-role for legacy display
  if (subRoles.includes("housekeeper")) return "user";
  if (subRoles.includes("reception")) return "reception";
  if (subRoles.includes("fnb")) return "fnb";
  if (subRoles.includes("maintenance")) return "maintenance";
  return "pending";
}

async function fetchDisplayName(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return (data as { display_name: string | null } | null)?.display_name ?? null;
}

async function refreshFromSession(session: import("@supabase/supabase-js").Session | null) {
  if (!session) {
    cachedToken = null;
    cachedUser = null;
    storeCachedUser(null);
    emit();
    return;
  }
  cachedToken = session.access_token;
  const u = session.user;
  const email = u.email ?? "";
  let position: Position = "pending";
  let subRoles: SubRole[] = [];
  let displayName: string | null = null;
  try {
    const [rr, dn] = await Promise.all([fetchRoleRows(u.id), fetchDisplayName(u.id)]);
    position = rr.position;
    subRoles = rr.subRoles;
    displayName = dn;
  } catch {
    /* keep defaults */
  }
  const username = displayName || email.split("@")[0] || "user";
  cachedUser = {
    id: u.id,
    username,
    email,
    position,
    subRoles,
    role: compatRole(position, subRoles),
  };
  storeCachedUser(cachedUser);
  emit();
}

export function bootstrapAuth() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;
  // Prime from local cache so first paint has a value.
  cachedUser = loadCachedUser();
  // Read current session, then subscribe to changes.
  void supabase.auth.getSession().then(({ data }) => refreshFromSession(data.session));
  supabase.auth.onAuthStateChange((_event, session) => {
    void refreshFromSession(session);
  });
}

export function getToken(): string | null {
  return cachedToken;
}

export function getStoredUser(): SessionUser | null {
  return cachedUser;
}

export async function refreshSession() {
  const { data } = await supabase.auth.getSession();
  await refreshFromSession(data.session);
}

export async function clearSession() {
  await supabase.auth.signOut();
  cachedToken = null;
  cachedUser = null;
  storeCachedUser(null);
  emit();
}

// Back-compat no-op (legacy callers that manually set a session).
export function setSession(_token?: string, _user?: SessionUser) {
  void refreshSession();
}