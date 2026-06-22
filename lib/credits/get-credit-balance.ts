// Server-side only.

export interface CreditBalance {
  credit_balance:   number;
  lifetime_credits: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCreditBalance(client: any, userId: string): Promise<CreditBalance | null> {
  const { data } = await client
    .from("customer_credits")
    .select("credit_balance, lifetime_credits")
    .eq("user_id", userId)
    .maybeSingle();

  return data as CreditBalance | null;
}
