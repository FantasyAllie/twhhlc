import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "entry-photos";
const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export type StayoverPhoto = {
  id: string;
  room_number: number;
  path: string;
  created_by_username: string | null;
  created_at: string;
};

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function uploadStayoverPhoto(
  roomNumber: number,
  file: File,
  username: string | null,
): Promise<{ ok: boolean; error?: string; path?: string; id?: string }> {
  let blob: Blob = file;
  try {
    blob = await imageCompression(file, {
      maxSizeMB: 1.2,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.8,
    });
  } catch {
    /* fallback to original */
  }
  const path = `stayover/${roomNumber}/${Date.now()}_${randomId()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (upErr) return { ok: false, error: upErr.message };
  const { data, error: insErr } = await supabase
    .from("stayover_photos" as never)
    .insert({ room_number: roomNumber, path, created_by_username: username } as never)
    .select("id")
    .single();
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: insErr.message };
  }
  return { ok: true, path, id: (data as { id: string } | null)?.id };
}

export async function listStayoverPhotos(roomNumber?: number): Promise<StayoverPhoto[]> {
  let q = supabase
    .from("stayover_photos" as never)
    .select("id,room_number,path,created_by_username,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (typeof roomNumber === "number") q = q.eq("room_number", roomNumber);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as StayoverPhoto[];
}

export async function deleteStayoverPhoto(id: string, path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from("stayover_photos" as never).delete().eq("id", id);
}

/** Delete photos captured today for the given room. */
export async function deleteTodayStayoverPhotosForRoom(roomNumber: number): Promise<void> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("stayover_photos" as never)
    .select("id,path")
    .eq("room_number", roomNumber)
    .gte("created_at", start.toISOString());
  if (error || !data) return;
  const rows = data as { id: string; path: string }[];
  if (rows.length === 0) return;
  await supabase.storage.from(BUCKET).remove(rows.map((r) => r.path));
  await supabase
    .from("stayover_photos" as never)
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    );
}

/** Delete photos older than 2 weeks. Safe to call on load. */
export async function purgeExpiredStayoverPhotos(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  const { data, error } = await supabase
    .from("stayover_photos" as never)
    .select("id,path")
    .lt("created_at", cutoff)
    .limit(500);
  if (error || !data) return;
  const rows = data as { id: string; path: string }[];
  if (rows.length === 0) return;
  await supabase.storage.from(BUCKET).remove(rows.map((r) => r.path));
  await supabase
    .from("stayover_photos" as never)
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    );
}

export async function getStayoverSignedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (paths.length === 0) return out;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return out;
  for (const item of data) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}