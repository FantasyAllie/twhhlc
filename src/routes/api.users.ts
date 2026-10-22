import { createFileRoute } from "@tanstack/react-router";
import {
  createUser,
  deleteUser,
  listHotels,
  listUsers,
  setUserDisabled,
  updateUserAssignment,
  updateUserPassword,
} from "@/lib/auth.functions";

// User management for the iPhone app: POST { action, data } with the signed-in
// person's Supabase token as "Authorization: Bearer …". Each action calls the
// same server function the website's Users dialog uses, so the sign-in check,
// admin/manager rules and hotel scoping are identical, and the admin key never
// leaves the server.
const ACTIONS = {
  list: () => listUsers(),
  hotels: () => listHotels(),
  create: (data: unknown) => createUser({ data: data as never }),
  update: (data: unknown) => updateUserAssignment({ data: data as never }),
  password: (data: unknown) => updateUserPassword({ data: data as never }),
  disable: (data: unknown) => setUserDisabled({ data: data as never }),
  delete: (data: unknown) => deleteUser({ data: data as never }),
} as const;

export const Route = createFileRoute("/api/users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { action?: string; data?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const run = body.action ? ACTIONS[body.action as keyof typeof ACTIONS] : undefined;
        if (!run) return Response.json({ error: "Unknown action" }, { status: 400 });
        try {
          const result = await run(body.data);
          return Response.json({ result });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Request failed";
          const status = /unauthori[sz]ed/i.test(message) ? 401 : /access required|permission|only|cannot/i.test(message) ? 403 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
