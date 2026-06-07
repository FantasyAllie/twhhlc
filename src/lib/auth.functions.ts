import { createServerFn } from "@tanstack/react-start";

// ---------- crypto helpers (Web Crypto, runtime-agnostic) ----------
const enc = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlFromString(s: string): string {
  return b64urlFromBytes(enc.encode(s));
}
function b64urlToString(s: string): string {
  return new TextDecoder().decode(b64urlToBytes(s));
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array;
  const iterations = 100000;
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = fromHex(parts[2]);
  const expected = fromHex(parts[3]);
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    expected.length * 8,
  );
  const got = new Uint8Array(bits);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
  return diff === 0;
}

async function getSecret(): Promise<string> {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Server auth secret missing");
  return s;
}

type TokenPayload = { sub: string; username: string; role: "admin" | "user"; exp: number };

async function signToken(payload: TokenPayload): Promise<string> {
  const secret = await getSecret();
  const header = b64urlFromString(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlFromString(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return `${data}.${b64urlFromBytes(sig)}`;
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const [h, b, s] = token.split(".");
    if (!h || !b || !s) return null;
    const secret = await getSecret();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(s) as BufferSource, enc.encode(`${h}.${b}`));
    if (!ok) return null;
    const payload = JSON.parse(b64urlToString(b)) as TokenPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function getAdminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireAdmin(token: string): Promise<TokenPayload> {
  const p = await verifyToken(token);
  if (!p) throw new Error("Not authenticated");
  if (p.role !== "admin") throw new Error("Admin access required");
  return p;
}

function validateUsername(u: string): string {
  const v = u.trim();
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(v)) {
    throw new Error("Username must be 2-32 chars (letters, numbers, _ . -)");
  }
  return v;
}
function validatePassword(p: string) {
  if (typeof p !== "string" || p.length < 6 || p.length > 128) {
    throw new Error("Password must be 6-128 characters");
  }
}

// ---------- server functions ----------

export type SessionUser = { id: string; username: string; role: "admin" | "user" };
export type AppUserRow = { id: string; username: string; role: "admin" | "user"; created_at: string };

export const login = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string }) => d)
  .handler(async ({ data }) => {
    const username = String(data.username ?? "").trim();
    const password = String(data.password ?? "");
    if (!username || !password) throw new Error("Username and password are required");
    const db = await getAdminDb();
    const { data: row, error } = await db
      .from("app_users")
      .select("id,username,password_hash,role")
      .ilike("username", username)
      .maybeSingle();
    if (error) throw new Error("Login failed");
    if (!row) throw new Error("Invalid username or password");
    const ok = await verifyPassword(password, (row as { password_hash: string }).password_hash);
    if (!ok) throw new Error("Invalid username or password");
    const r = row as { id: string; username: string; role: "admin" | "user" };
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
    const token = await signToken({ sub: r.id, username: r.username, role: r.role, exp });
    const user: SessionUser = { id: r.id, username: r.username, role: r.role };
    return { token, user };
  });

export const me = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }): Promise<SessionUser | null> => {
    const p = await verifyToken(data.token);
    if (!p) return null;
    return { id: p.sub, username: p.username, role: p.role };
  });

export const listUsers = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }): Promise<AppUserRow[]> => {
    await requireAdmin(data.token);
    const db = await getAdminDb();
    const { data: rows, error } = await db
      .from("app_users")
      .select("id,username,role,created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as AppUserRow[];
  });

export const createUser = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; username: string; password: string; role: "admin" | "user" }) => d)
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const username = validateUsername(data.username);
    validatePassword(data.password);
    if (data.role !== "admin" && data.role !== "user") throw new Error("Invalid role");
    const db = await getAdminDb();
    const { data: existing } = await db
      .from("app_users")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (existing) throw new Error("That username is already taken");
    const password_hash = await hashPassword(data.password);
    const { error } = await db.from("app_users").insert({ username, password_hash, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; password: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    validatePassword(data.password);
    const password_hash = await hashPassword(data.password);
    const db = await getAdminDb();
    const { error } = await db
      .from("app_users")
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string; role: "admin" | "user" }) => d)
  .handler(async ({ data }) => {
    const actor = await requireAdmin(data.token);
    if (data.role !== "admin" && data.role !== "user") throw new Error("Invalid role");
    const db = await getAdminDb();
    if (data.role === "user") {
      // Prevent removing the last admin
      const { count } = await db
        .from("app_users")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1 && actor.sub === data.id) {
        throw new Error("Cannot demote the only remaining admin");
      }
    }
    const { error } = await db
      .from("app_users")
      .update({ role: data.role, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    const actor = await requireAdmin(data.token);
    if (actor.sub === data.id) throw new Error("You cannot delete your own account");
    const db = await getAdminDb();
    const { error } = await db.from("app_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMyPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; currentPassword: string; newPassword: string }) => d)
  .handler(async ({ data }) => {
    const p = await verifyToken(data.token);
    if (!p) throw new Error("Not authenticated");
    validatePassword(data.newPassword);
    const db = await getAdminDb();
    const { data: row, error } = await db
      .from("app_users")
      .select("password_hash")
      .eq("id", p.sub)
      .maybeSingle();
    if (error || !row) throw new Error("Account not found");
    const ok = await verifyPassword(data.currentPassword, (row as { password_hash: string }).password_hash);
    if (!ok) throw new Error("Current password is incorrect");
    const password_hash = await hashPassword(data.newPassword);
    const { error: uerr } = await db
      .from("app_users")
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq("id", p.sub);
    if (uerr) throw new Error(uerr.message);
    return { ok: true };
  });

export const updateMyUsername = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; currentPassword: string; newUsername: string }) => d)
  .handler(async ({ data }): Promise<{ token: string; user: SessionUser }> => {
    const p = await verifyToken(data.token);
    if (!p) throw new Error("Not authenticated");
    const username = validateUsername(data.newUsername);
    const db = await getAdminDb();
    const { data: row, error } = await db
      .from("app_users")
      .select("password_hash,role")
      .eq("id", p.sub)
      .maybeSingle();
    if (error || !row) throw new Error("Account not found");
    const ok = await verifyPassword(data.currentPassword, (row as { password_hash: string }).password_hash);
    if (!ok) throw new Error("Current password is incorrect");
    const { data: existing } = await db
      .from("app_users")
      .select("id")
      .ilike("username", username)
      .neq("id", p.sub)
      .maybeSingle();
    if (existing) throw new Error("That username is already taken");
    const { error: uerr } = await db
      .from("app_users")
      .update({ username, updated_at: new Date().toISOString() })
      .eq("id", p.sub);
    if (uerr) throw new Error(uerr.message);
    const role = (row as { role: "admin" | "user" }).role;
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    const token = await signToken({ sub: p.sub, username, role, exp });
    return { token, user: { id: p.sub, username, role } };
  });