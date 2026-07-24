export type DemoAvailability =
  | { allowed: true }
  | { allowed: false; status: 404; error: "Demo execution is unavailable." };

/**
 * The public demo may run only when the whole server is explicitly in demo
 * mode. This fail-closed gate prevents /api/demo from reaching real AI/search
 * providers in production due to a route-level assumption.
 */
export function demoAvailability(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DemoAvailability {
  return env.DEMO_MODE === "true"
    ? { allowed: true }
    : { allowed: false, status: 404, error: "Demo execution is unavailable." };
}
