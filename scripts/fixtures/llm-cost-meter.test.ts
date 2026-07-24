import { calculateAnthropicListCost, ANTHROPIC_PRICING } from "@/lib/anthropic";

let passed = 0;
function test(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`PASS: ${name}`);
}

test("official configured rates are $3/$15 per MTok", ANTHROPIC_PRICING.inputUsdPerMillion === 3 && ANTHROPIC_PRICING.outputUsdPerMillion === 15);
test("1M input tokens calculate to $3", calculateAnthropicListCost(1_000_000, 0) === 3);
test("1M output tokens calculate to $15", calculateAnthropicListCost(0, 1_000_000) === 15);
test("typical small call is measured in cents", calculateAnthropicListCost(5_000, 1_000) === 0.03);
console.log(`\n${passed}/4 LLM cost assertions passed.`);
