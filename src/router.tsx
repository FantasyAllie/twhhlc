import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Cache defaults: avoid refetching every list on each mount/tab focus.
  // Live updates still arrive via the realtime subscriptions + invalidations.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
      // Short stale window: mobile browsers freeze websockets in the
        // background, so focus/reconnect refetches are the safety net.
        staleTime: 10_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: "always",
        refetchOnReconnect: "always",
        refetchOnMount: true,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
