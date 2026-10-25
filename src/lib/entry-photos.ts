import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

export type EntryKind = "lost_property" | "maintenance";
export const MAX_PHOTOS_PER_ENTRY = 4;

const BUCKET = "entry-photos";

/** Maintenance jobs may carry short video clips alongside photos. */
export const MAX_CLIP_SECONDS = 5;
export const MAX_CLIP_BYTES = 50 * 1024 * 1024;

export const isVideoFile = (f: File) => f.type.startsWith("video/");

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : Infinity);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(Infinity);
    };
    v.src = url;
  });
}

/** Returns an error message when a clip is too long or too large, else null. */
export async function checkClip(file: File): Promise<string | null> {
  if (file.size > MAX_CLIP_BYTES) return "Clip is too large (max 50MB)";
  const d = await readDuration(file);
  if (d > MAX_CLIP_SECONDS + 0.5) return `Clips must be ${MAX_CLIP_SECONDS} seconds or shorter`;
  return null;
}

const urlCache = new Map<string, { url: string; expiresAt: number }>();

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function compressImage(file: File): Promise<Blob> {
  try {
    const out = await imageCompression(file, {
      maxSizeMB: 1.2,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/jpeg",
      initialQuality: 0.8,
    });
    return out;
  } catch {
    return file;
  }
}

export async function uploadEntryPhotos(
  kind: EntryKind,
  entryId: string,
  files: File[],
): Promise<{ paths: string[]; errors: string[] }> {
  const paths: string[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      const video = isVideoFile(f);
      const blob = video ? f : await compressImage(f);
      const ext = video ? (/quicktime/i.test(f.type) || /\.mov$/i.test(f.name) ? "mov" : "mp4") : "jpg";
      const path = `${kind}/${entryId}/${randomId()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: video ? f.type || "video/mp4" : "image/jpeg", upsert: false });
      if (error) {
        errors.push(error.message);
        continue;
      }
      paths.push(path);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { paths, errors };
}

export async function getSignedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const now = Date.now();
  const need: string[] = [];
  for (const p of paths) {
    const c = urlCache.get(p);
    if (c && c.expiresAt > now + 60_000) out[p] = c.url;
    else need.push(p);
  }
  if (need.length > 0) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(need, 3600);
    if (!error && data) {
      for (const item of data) {
        if (item.path && item.signedUrl) {
          out[item.path] = item.signedUrl;
          urlCache.set(item.path, { url: item.signedUrl, expiresAt: now + 3600_000 });
        }
      }
    }
  }
  return out;
}

export async function deleteEntryPhoto(path: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  urlCache.delete(path);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
