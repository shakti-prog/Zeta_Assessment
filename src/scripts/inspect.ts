import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const CID = '550e8400-e29b-41d4-a716-446655440000';
  const bal = await prisma.balance.findUnique({ where: { customerId: CID } });
  const pays = await prisma.payment.findMany({ where: { customerId: CID }, orderBy: { createdAt: 'desc' }, take: 5 });
  const cases = await prisma.case.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log('Balance cents:', bal?.availableCents?.toString());
  console.log('Recent payments:', pays.map(p => ({ id: p.id, decision: p.decision, amountCents: p.amountCents.toString() })));
  console.log('Recent cases:', cases.map(c => ({ paymentId: c.paymentId, status: c.status })));
  await prisma.$disconnect();
})();
