import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../store/prisma.service";

@Injectable()
export class IdempotencyRepo {
  constructor(private readonly prisma: PrismaService) {}

  async find(customerId: string, key: string) {
    return this.prisma.idempotency.findFirst({
      where: { customerId, key },
      select: { response: true },
    });
  }

  async save(customerId: string, key: string, response: any) {
    
    try {
      await this.prisma.idempotency.create({
        data: { customerId, key, response },
      });
    } catch (_) {
   
    }
  }
}