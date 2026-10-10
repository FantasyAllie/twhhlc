import { createFileRoute, redirect } from "@tanstack/react-router";

// The dedicated /users page is superseded by the Users dialog opened from
// Settings. Redirect any old links to /app so admins land on the same tools.
export const Route = createFileRoute("/users")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Team access — The Hotel Hub" },
    { name: "description", content: "Manage team access in The Hotel Hub." },
    { property: "og:title", content: "Team access — The Hotel Hub" },
    { property: "og:description", content: "Manage team access in The Hotel Hub." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
