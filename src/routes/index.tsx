import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  // SSR has no localStorage; route to the gate on the client.
  ssr: false,
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
