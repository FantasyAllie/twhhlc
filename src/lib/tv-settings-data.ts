// Loading and saving lobby screen settings (browser only).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRANDING_BUCKET, normalizeSettings, type ScreenSettings } from "./tv-settings";

export const screenSettingsKey = (hotelId: string | undefined) => ["hotel_screen_settings", hotelId] as const;

export function useScreenSettings(hotelId: string | undefined) {
  return useQuery({
    queryKey: screenSettingsKey(hotelId),
    enabled: !!hotelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_screen_settings" as never)
        .select("*")
        .eq("hotel_id" as never, hotelId as never)
        .maybeSingle();
      if (error) throw error;
      return { settings: normalizeSettings(hotelId!, data as Record<string, unknown> | null), saved: !!data };
    },
    staleTime: 60_000,
    // A missing table (database update not applied yet) won't fix itself by retrying.
    retry: (count, e) => !/hotel_screen_settings/.test((e as { message?: string })?.message ?? "") && count < 2,
  });
}

export async function saveScreenSettings(s: ScreenSettings) {
  const { error } = await supabase
    .from("hotel_screen_settings" as never)
    .upsert(s as never, { onConflict: "hotel_id" });
  if (error) throw error;
}

/**
 * The bucket is private (public buckets are off for the workspace), so images
 * load through signed links. They last a day and are renewed every few hours,
 * so a TV left on all week keeps its pictures.
 */
export function useBrandingUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))].sort();
  const q = useQuery({
    queryKey: ["hotel-branding-urls", list],
    enabled: list.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BRANDING_BUCKET).createSignedUrls(list, 24 * 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      return map;
    },
    staleTime: 6 * 60 * 60 * 1000,
    refetchInterval: 6 * 60 * 60 * 1000,
  });
  const map = q.data ?? {};
  return (path: string | null | undefined): string | null => (path ? map[path] ?? null : null);
}

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Uploads a logo or photo under the hotel's folder and returns its path. */
export async function uploadBrandingImage(hotelId: string, kind: string, file: File): Promise<string> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Use a PNG, JPEG or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("That image is over 5 MB. Try a smaller one.");
  const path = `${hotelId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeBrandingImage(path: string | null) {
  if (!path) return;
  await supabase.storage.from(BRANDING_BUCKET).remove([path]);
}

/** UK postcode → map position (postcodes.io, free, no key). */
export async function lookupPostcode(postcode: string): Promise<{ postcode: string; latitude: number; longitude: number } | null> {
  const clean = postcode.trim().toUpperCase();
  if (!clean) return null;
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
  if (!res.ok) return null;
  const body = await res.json();
  const r = body?.result;
  if (!r || typeof r.latitude !== "number" || typeof r.longitude !== "number") return null;
  return { postcode: r.postcode ?? clean, latitude: r.latitude, longitude: r.longitude };
}
