import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const CID = '550e8400-e29b-41d4-a716-446655440000';
  await prisma.balance.upsert({
    where: { customerId: CID },
    update: { availableCents: 10000n },
    create: { customerId: CID, availableCents: 10000n },
  });
  console.log('Seeded balance to ₹100.00');
  await prisma.$disconnect();
})();
