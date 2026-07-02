import { createFileRoute, redirect } from "@tanstack/react-router";

// The dedicated /users page is superseded by the Users dialog opened from
// Settings. Redirect any old links to /app so admins land on the same tools.
export const Route = createFileRoute("/users")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
