import type { Instrumentation } from "next";

/**
 * Runs once when the server starts: says in the log what is and isn't configured, and schedules daily upkeep
 * (src/lib/maintenance.ts). The site runs as one process, so a timer here is the whole scheduler.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startServerTasks } = await import("./lib/server/startup");
  startServerTasks();
}

/** Every error the server catches while rendering or handling a request, as one log line. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { log } = await import("./lib/log");
  log.error("request.error", {
    err,
    method: request.method,
    // The path without its query string: a query can hold what someone typed.
    path: request.path.split("?")[0],
    route: context.routePath,
    kind: context.routeType,
  });
};
