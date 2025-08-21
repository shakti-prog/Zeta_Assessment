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


/* # Start your app
npm run start:dev

# Make a test call
CID="550e8400-e29b-41d4-a716-446655440000"
curl -s -X POST http://localhost:3000/payments/decide \
  -H "Content-Type: application/json" -H "X-API-Key: secret-dev-key" \
  -d '{"customerId":"'"$CID"'","payeeId":"m1","amount":10,"currency":"INR","idempotencyKey":"seed-check-1"}' | jq
*/ 