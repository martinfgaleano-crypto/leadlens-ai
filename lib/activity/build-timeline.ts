// Pure activity timeline builder — no DB access.
// Merges searches, credit transactions, and notifications into a unified
// chronological feed, sorted newest first.

export type ActivityType =
  | "search_completed"
  | "search_failed"
  | "credits_consumed"
  | "credits_added"
  | "notification";

export interface ActivityEvent {
  id:        string;
  type:      ActivityType;
  title:     string;
  timestamp: string;
  meta?:     Record<string, unknown>;
}

export interface TimelineSearch {
  id:                      string;
  name:                    string;
  status:                  string;
  created_at:              string;
  process_generated_count?: number | null;
}

export interface TimelineCreditTxn {
  id:          string;
  type:        string;
  amount:      number;
  description: string | null;
  created_at:  string;
}

export interface TimelineNotification {
  id:         string;
  type:       string;
  title:      string;
  created_at: string;
}

/**
 * Builds a unified activity feed from heterogeneous data sources.
 * All inputs are plain arrays — no async, no DB.
 */
export function buildTimeline(
  searches:      TimelineSearch[],
  transactions:  TimelineCreditTxn[],
  notifications: TimelineNotification[],
  limit = 10,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const s of searches) {
    if (s.status === "completed") {
      events.push({
        id:        `search-${s.id}`,
        type:      "search_completed",
        title:     `Search completed: ${s.name}`,
        timestamp: s.created_at,
        meta:      { search_id: s.id, leads: s.process_generated_count ?? 0 },
      });
    } else if (s.status === "failed") {
      events.push({
        id:        `search-${s.id}`,
        type:      "search_failed",
        title:     `Search failed: ${s.name}`,
        timestamp: s.created_at,
        meta:      { search_id: s.id },
      });
    }
  }

  for (const t of transactions) {
    if (t.type === "consume") {
      events.push({
        id:        `txn-${t.id}`,
        type:      "credits_consumed",
        title:     t.description ?? "Credits consumed",
        timestamp: t.created_at,
        meta:      { amount: Math.abs(t.amount) },
      });
    } else if (t.type === "grant" || t.type === "manual") {
      events.push({
        id:        `txn-${t.id}`,
        type:      "credits_added",
        title:     t.description ?? "Credits added",
        timestamp: t.created_at,
        meta:      { amount: t.amount },
      });
    }
  }

  for (const n of notifications) {
    events.push({
      id:        `notif-${n.id}`,
      type:      "notification",
      title:     n.title,
      timestamp: n.created_at,
      meta:      { notification_type: n.type },
    });
  }

  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
