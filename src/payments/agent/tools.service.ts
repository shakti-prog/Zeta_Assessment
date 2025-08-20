import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../store/prisma.service";

export type RiskSignals = {
  recent_disputes: number;
  device_change: boolean;
  velocity_score: number;
};

@Injectable()
export class ToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(customerId: string): Promise<bigint> {
    const rec = await this.prisma.balance.findUnique({ where: { customerId } });
    return rec ? rec.availableCents : 0n;
  }

  async getRiskSignals(
    customerId: string,
    payeeId: string
  ): Promise<RiskSignals> {
    const h = this.hash(`${customerId}|${payeeId}`);
    const recent_disputes = h % 3 === 0 ? 2 : h % 3 === 1 ? 1 : 0;
    const device_change = (h >> 1) % 2 === 0;
    const velocity_score = h % 101; 
    return { recent_disputes, device_change, velocity_score };
  }


  async createCase(paymentId: string, reason: string) {
    await this.prisma.case.create({
      data: { paymentId, status: `OPEN:${reason}` },
    });
  }

  private hash(s: string): number {
    let x = 0;
    for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
    return x;
  }
}
