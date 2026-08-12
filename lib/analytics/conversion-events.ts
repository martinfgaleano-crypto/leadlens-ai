import { z } from "zod";

export const CONVERSION_EVENTS = [
  "landing_view", "hero_cta_click", "nav_cta_click", "pricing_view",
  "pricing_plan_select", "onboarding_start", "onboarding_step_complete",
  "onboarding_submit", "onboarding_error", "onboarding_success",
] as const;

export const conversionMetadataSchema = z.object({
  plan: z.enum(["sample", "starter", "standard", "pro"]).optional(),
  source_cta: z.enum(["announcement", "nav", "hero", "sample_bridge", "pricing", "final", "demo", "monitor"]).optional(),
  step: z.number().int().min(1).max(10).optional(),
  error_category: z.enum(["validation", "network", "server", "unavailable", "unknown"]).optional(),
}).strict();

export type ConversionEvent = typeof CONVERSION_EVENTS[number];
export type ConversionMetadata = z.infer<typeof conversionMetadataSchema>;

export function safeConversionPayload(event: ConversionEvent, metadata: ConversionMetadata = {}) {
  return { event, ...conversionMetadataSchema.parse(metadata) };
}
