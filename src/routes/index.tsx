import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getToken } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  // SSR has no localStorage; route to the gate on the client.
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: getToken() ? "/app" : "/login", replace: true });
  }, [navigate]);
  return null;
}
