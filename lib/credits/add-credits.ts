// Server-side only. Grants credits to a user and records the transaction.
// Creates a customer_credits row if one does not exist yet (defensive fallback;
// the DB trigger on profiles INSERT normally creates it on signup).

export type CreditGrantType = "grant" | "refund" | "manual";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addCredits(
  client:      any,
  userId:      string,
  amount:      number,
  description: string,
  type:        CreditGrantType = "grant",
  searchId?:   string,
): Promise<{ credit_balance: number }> {
  if (amount <= 0) throw new Error("amount must be positive");

  const { data: existing } = await client
    .from("customer_credits")
    .select("credit_balance, lifetime_credits")
    .eq("user_id", userId)
    .maybeSingle();

  let newBalance: number;

  if (existing) {
    newBalance = (existing.credit_balance as number) + amount;
    await client
      .from("customer_credits")
      .update({
        credit_balance:   newBalance,
        lifetime_credits: (existing.lifetime_credits as number) + amount,
      })
      .eq("user_id", userId);
  } else {
    newBalance = amount;
    await client
      .from("customer_credits")
      .insert({ user_id: userId, credit_balance: amount, lifetime_credits: amount });
  }

  await client
    .from("credit_transactions")
    .insert({
      user_id:     userId,
      type,
      amount,
      description,
      search_id:   searchId ?? null,
    });

  return { credit_balance: newBalance };
}
