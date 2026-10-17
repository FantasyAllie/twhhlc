// Circular user display photos stored in the private "avatars" bucket at
// "<lowercased username>.jpg", read back through short-lived signed URLs.
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const avatarPath = (name: string) => `${name.trim().toLowerCase()}.jpg`;

export function useAvatarUrls(names: string[]) {
  const key = [...new Set(names.filter(Boolean).map((n) => n.trim().toLowerCase()))].sort();
  return useQuery({
    queryKey: ["avatars", key],
    enabled: key.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("avatars").createSignedUrls(key.map((k) => `${k}.jpg`), 3600);
      const map: Record<string, string> = {};
      for (const d of data ?? []) {
        if (d.signedUrl && d.path) map[d.path.replace(/\.jpg$/, "")] = d.signedUrl;
      }
      return map;
    },
  });
}

export function UserAvatar({ name, url, className }: { name: string; url?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground font-semibold", className)}>
      {url && !broken ? (
        <img src={url} alt={name} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="text-[0.8em]">{initial}</span>
      )}
    </span>
  );
}

export function NamedAvatar({ name, className }: { name: string; className?: string }) {
  const { data } = useAvatarUrls([name]);
  return <UserAvatar key={data?.[name.trim().toLowerCase()] ?? "none"} name={name} url={data?.[name.trim().toLowerCase()]} className={className} />;
}

async function toSquareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not read photo"))), "image/jpeg", 0.85));
}

export function AvatarEditor({ username }: { username: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useAvatarUrls([username]);
  const url = data?.[username.trim().toLowerCase()];

  async function upload(file: File) {
    setBusy(true);
    try {
      const blob = await toSquareJpeg(file);
      const { error } = await supabase.storage.from("avatars").upload(avatarPath(username), blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["avatars"] });
      toast.success("Display photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.storage.from("avatars").remove([avatarPath(username)]);
    setBusy(false);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["avatars"] });
    toast.success("Display photo removed");
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar key={url ?? "none"} name={username} url={url} className="h-16 w-16 text-2xl" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {url ? "Change photo" : "Add photo"}
        </Button>
        {url && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
    </div>
  );
}
