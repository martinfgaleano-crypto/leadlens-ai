// Server-side only. Deducts credits and records a consume transaction.
// Returns { success: false } without throwing if balance is insufficient.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function consumeCredits(
  client:      any,
  userId:      string,
  amount:      number,
  description: string,
  searchId?:   string,
): Promise<{ success: boolean; credit_balance: number }> {
  if (amount <= 0) throw new Error("amount must be positive");

  const { data: existing } = await client
    .from("customer_credits")
    .select("credit_balance")
    .eq("user_id", userId)
    .maybeSingle();

  const currentBalance = (existing?.credit_balance as number) ?? 0;

  if (currentBalance < amount) {
    return { success: false, credit_balance: currentBalance };
  }

  const newBalance = currentBalance - amount;

  await client
    .from("customer_credits")
    .update({ credit_balance: newBalance })
    .eq("user_id", userId);

  await client
    .from("credit_transactions")
    .insert({
      user_id:   userId,
      type:      "consume",
      amount:    -amount,   // negative — credits left the account
      description,
      search_id: searchId ?? null,
    });

  return { success: true, credit_balance: newBalance };
}
