// Server-side only. Pipeline tracking stats for vault_candidates.

export interface CandidateStats {
  new_candidates:       number;
  needs_review:         number;
  reviewed_candidates:  number; // needs_review + approved + rejected + duplicate
  approved_candidates:  number;
  rejected_candidates:  number;
  duplicate_candidates: number;
  promoted_candidates:  number;
  approval_rate_pct:    number; // approved / (approved + rejected) * 100
  promotion_rate_pct:   number; // promoted / approved * 100
  total_candidates:     number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCandidateStats(client: any): Promise<CandidateStats> {
  const statuses = ["new", "needs_review", "approved", "rejected", "duplicate"] as const;

  // Count by status in one query each — avoids GROUP BY which needs rpc or raw sql
  const counts = await Promise.all(
    statuses.map(status =>
      client
        .from("vault_candidates")
        .select("id", { count: "exact", head: true })
        .eq("review_status", status)
        .then(({ count }: { count: number | null }) => count ?? 0)
    )
  );

  const [newCount, needsReview, approved, rejected, duplicate] = counts as number[];

  // Promoted = approved candidates that have a promoted_at set
  const { count: promoted } = await client
    .from("vault_candidates")
    .select("id", { count: "exact", head: true })
    .not("promoted_at", "is", null);

  const promotedCount    = promoted ?? 0;
  const reviewed         = needsReview + approved + rejected + duplicate;
  const total            = newCount + reviewed;
  const approvalBase     = approved + rejected;
  const approvalRatePct  = approvalBase > 0 ? Math.round((approved / approvalBase) * 100) : 0;
  const promotionRatePct = approved    > 0 ? Math.round((promotedCount / approved) * 100) : 0;

  return {
    new_candidates:       newCount,
    needs_review:         needsReview,
    reviewed_candidates:  reviewed,
    approved_candidates:  approved,
    rejected_candidates:  rejected,
    duplicate_candidates: duplicate,
    promoted_candidates:  promotedCount,
    approval_rate_pct:    approvalRatePct,
    promotion_rate_pct:   promotionRatePct,
    total_candidates:     total,
  };
}
