import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  // SSR has no localStorage; route to the gate on the client.
  ssr: false,
  head: () => ({ meta: [
    { title: "Welcome — The Hotel Hub" },
    { name: "description", content: "Access your hotel's daily operations in The Hotel Hub." },
    { property: "og:title", content: "Welcome — The Hotel Hub" },
    { property: "og:description", content: "Access your hotel's daily operations in The Hotel Hub." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      navigate({ to: data.session ? "/app" : "/login", replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);
  return null;
}
