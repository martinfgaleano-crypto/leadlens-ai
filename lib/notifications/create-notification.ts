// In-app notification helper. Server-side only.
// Never throws — notification failure must never block any business flow.

export type NotificationType =
  | "search_completed"
  | "search_failed"
  | "credits_low"
  | "credits_added";

export interface CreateNotificationInput {
  userId:    string;
  type:      NotificationType;
  title:     string;
  message:   string;
  metadata?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createNotification(
  client: any,
  input:  CreateNotificationInput,
): Promise<void> {
  try {
    await client.from("notifications").insert({
      user_id:  input.userId,
      type:     input.type,
      title:    input.title,
      message:  input.message,
      metadata: input.metadata ?? null,
    });
  } catch {
    // Swallow all errors — notifications are best-effort
  }
}
