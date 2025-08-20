import type { RiskSignals } from './tools.service';

export type Decision = 'allow' | 'review' | 'block';

export function decide(
  amountCents: bigint,
  availableCents: bigint,
  risk: RiskSignals,
  dailyThresholdCents: bigint,
): { decision: Decision; reasons: string[] } {
  
  if (amountCents > availableCents) {
    return { decision: 'block', reasons: ['insufficient_funds'] };
  }
  const reasons: string[] = [];
  if (risk.recent_disputes >= 2) reasons.push('recent_disputes');
  if (amountCents > dailyThresholdCents) reasons.push('amount_above_daily_threshold');
  if (reasons.length > 0) return { decision: 'review', reasons };
  return { decision: 'allow', reasons: [] };
}
