import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "user" | "reception" | "pending";
export type SessionUser = { id: string; username: string; email: string; role: AppRole };

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

async function fetchRole(userId: string): Promise<AppRole> {
  // Returns the highest-privilege role we find, or "pending" if none.
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
  const order: AppRole[] = ["admin", "reception", "user", "pending"];
  for (const r of order) if (roles.includes(r)) return r;
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
  let role: AppRole = "pending";
  let displayName: string | null = null;
  try {
    [role, displayName] = await Promise.all([fetchRole(u.id), fetchDisplayName(u.id)]);
  } catch {
    /* keep defaults */
  }
  const username = displayName || email.split("@")[0] || "user";
  cachedUser = { id: u.id, username, email, role };
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