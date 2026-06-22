// Server-side only.

export interface CreditTransaction {
  id:          string;
  type:        string;
  amount:      number;
  description: string | null;
  search_id:   string | null;
  created_at:  string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCreditHistory(
  client: any,
  userId: string,
  limit = 20,
): Promise<CreditTransaction[]> {
  const { data } = await client
    .from("credit_transactions")
    .select("id, type, amount, description, search_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as CreditTransaction[];
}
