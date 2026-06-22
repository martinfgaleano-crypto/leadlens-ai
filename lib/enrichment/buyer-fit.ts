export type BuyerFit = "Excellent fit" | "Good fit" | "Weak fit";

export function computeBuyerFit(leadScore: number): BuyerFit {
  if (leadScore >= 80) return "Excellent fit";
  if (leadScore >= 60) return "Good fit";
  return "Weak fit";
}
