import { Injectable } from "@nestjs/common";
import { ToolsService } from "./tools.service";
import { decide } from "./rules";

@Injectable()
export class AgentService {
  constructor(private readonly tools: ToolsService) {}

  async run(params: {
    customerId: string;
    payeeId: string;
    amountCents: bigint;
    currency: string;
    requestId: string;
    dailyThresholdCents: bigint;
  }) {
    const { customerId, payeeId, amountCents, requestId, dailyThresholdCents } =
      params;

    const trace: Array<{ step: string; detail: string }> = [];
    trace.push({ step: "plan", detail: "Check balance, risk, and limits" });


    const balancePromise = this.withRetry(
      () => this.tools.getBalance(customerId),
      2,
      "getBalance",
      trace
    );
    const riskPromise = this.withRetry(
      () => this.tools.getRiskSignals(customerId, payeeId),
      2,
      "getRiskSignals",
      trace
    );

    const [availableCents, risk] = await Promise.all([
      balancePromise,
      riskPromise,
    ]);

    trace.push({
      step: "tool:getBalance",
      detail: `availableCents=${availableCents.toString()}`,
    });
    trace.push({
      step: "tool:getRiskSignals",
      detail: `recent_disputes=${risk.recent_disputes}, device_change=${risk.device_change}, velocity_score=${risk.velocity_score}`,
    });

    const { decision, reasons } = decide(
      amountCents,
      availableCents,
      risk,
      dailyThresholdCents
    );
    trace.push({
      step: "rules",
      detail: `decision=${decision}${
        reasons.length ? `, reasons=${reasons.join("|")}` : ""
      }`,
    });

    return {
      decision,
      reasons,
      agentTrace: trace,
      requestId,
    };
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    attempts: number,
    label: string,
    trace: Array<{ step: string; detail: string }>
  ): Promise<T> {
    let lastErr: any;
    for (let i = 1; i <= attempts; i++) {
      try {
        const r = await fn();
        if (i > 1)
          trace.push({
            step: `retry:${label}`,
            detail: `success on attempt ${i}`,
          });
        return r;
      } catch (e) {
        lastErr = e;
        trace.push({
          step: `retry:${label}`,
          detail: `attempt ${i} failed: ${(e as Error).message}`,
        });
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    throw lastErr;
  }
}
