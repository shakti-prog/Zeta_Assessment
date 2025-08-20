import { Injectable } from "@nestjs/common";
import { DecideDto } from "./dto/decide.dto";
import { AgentService } from "./agent/agent.service";
import { PrismaService } from "../store/prisma.service";
import { LocksService } from "../common/locks/lock.service";
import { Logger } from "nestjs-pino";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly agent: AgentService,
    private readonly prisma: PrismaService,
    private readonly locks: LocksService,
    private readonly logger: Logger
  ) {}

  async decide(dto: DecideDto, requestId: string) {
    this.logger.log(
      {
        customerId: dto.customerId,
        payeeId: dto.payeeId,
        amount: dto.amount,
        currency: dto.currency,
      },
      "decide: received"
    );

    const amountCents = toCents(dto.amount);
    const dailyThresholdCents = BigInt(
      process.env.DAILY_THRESHOLD_CENTS ?? "20000"
    );

    const agentRes = await this.agent.run({
      customerId: dto.customerId,
      payeeId: dto.payeeId,
      amountCents,
      currency: dto.currency,
      requestId,
      dailyThresholdCents,
    });
    const dec = agentRes.decision;
    const reasons = agentRes.reasons;
    this.logger.log(
      {
        dec,
        reasons,
        requestId,
        amount: dto.amount,
        customerId: dto.customerId,
      },
      "decide: result"
    );

    return await this.locks.get(dto.customerId).runExclusive(async () => {
      return await this.prisma.$transaction(async (tx) => {
        const bal = await tx.balance.findUnique({
          where: { customerId: dto.customerId },
        });
        const available = bal ? bal.availableCents : 0n;

        let decision = agentRes.decision;
        let reasons = [...agentRes.reasons];
        const agentTrace = [...agentRes.agentTrace];

        if (decision === "allow") {
          if (available < amountCents) {
            decision = "block";
            reasons = ["insufficient_funds"];
            agentTrace.push({
              step: "lock:recheck",
              detail: "insufficient after recheck",
            });
          } else {
            const newAvail = available - amountCents;
            if (bal) {
              await tx.balance.update({
                where: { customerId: dto.customerId },
                data: { availableCents: newAvail },
              });
            } else {
              await tx.balance.create({
                data: { customerId: dto.customerId, availableCents: newAvail },
              });
            }
          }
        }

        // Always insert a payment row
        const payment = await tx.payment.create({
          data: {
            customerId: dto.customerId,
            payeeId: dto.payeeId,
            amountCents,
            currency: dto.currency,
            decision,
          },
          select: { id: true },
        });

        if (decision !== "allow") {
          const reason = reasons[0] ?? "manual_review";
          await tx.case.create({
            data: { paymentId: payment.id, status: `OPEN:${reason}` },
          });
        }

        return {
          decision,
          reasons,
          agentTrace,
          requestId,
        };
      });
    });
  }
}

function toCents(n: number): bigint {
  // simple conversion; OK for this take-home. (If you want stricter: parse from string)
  return BigInt(Math.round(n * 100));
}
