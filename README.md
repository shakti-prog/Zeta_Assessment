# Zeta_Assessment
# Payments Decisioning Service (NestJS + SQLite)

Backend‐heavy solution for the Zeta Assessment. Features: API-key auth, token-bucket rate limiting, idempotency with replay, transactional balance updates, a deterministic "agent" with planning + tool calls (with retries/guardrails), structured logging with PII redaction, and Prometheus metrics.

---

## 🚀 Run locally (2–3 commands)

```bash
npm ci
npx prisma generate
npm run start:dev
```

## 🧭 Endpoints

**POST /payments/decide**
```
Headers: X-API-Key: <key> (required), optional x-request-id.

Body: { 
  "customerId": "<uuid>", 
  "payeeId": "<string>", 
  "amount": 10, 
  "currency": "INR", 
  "idempotencyKey": "<string>" 
}

Response (example): { 
  "decision": "allow|review|block", 
  "reasons": ["threshold_exceeded", "insufficient_funds", "stub", "..."],
  "agentTrace": [
    {"step": "plan", "detail": "..."},
    {"step": "tool:fetchBalance", "ok": true, "tries": 1}
  ],
  "requestId": "<uuid>"
}
```

**GET /metrics** → Prometheus text format (auto-logging ignored for this path)

## 🏗️ Architecture (ASCII)

```
┌───────────┐      ┌──────────────────┐      ┌──────────────────────┐
│   Client  │ ───▶ │  Nest Controller │ ───▶ │  Guards & Intercpts  │
└───────────┘      └──────────────────┘      ├──────────────────────┤
         POST /payments/decide               │ APIKeyGuard          │
                                             │ RateLimitGuard       │
                                             │ RequestIdInterceptor │
                                             │ IdempotencyInterceptor (cache & replay)
                                             └─────────┬────────────┘
                                                      │
                                              ┌───────▼────────┐
                                              │ PaymentsService │
                                              └───────┬────────┘
                                                      │
                                              ┌───────▼──────────────┐
                                              │  Agent (deterministic│
                                              │  plan + tools+retry) │
                                              └───────┬──────────────┘
                                                      │ tool calls
                          ┌───────────────────────────▼───────────────────────────┐
                          │                      Store (Prisma)                   │
                          │  - getBalance, listRecentPayments, beginTxn+lock,    │
                          │    createPayment, updateBalance, commit/rollback     │
                          │  - IdempotencyRepo (Req→Response cache)              │
                          └───────────────────────────────────────────────────────┘
```

## Observability

- **Logger** (nestjs-pino): redaction, requestId correlation, level mapping, pretty in dev
- **Metrics** (/metrics): nodejs_* and custom counters (rate-limit drops, decisions, etc.)

## ⚙️ What I optimized

### Latency
- In-process SQLite (no network hop)
- Simple agent with deterministic rules and minimal I/O
- Token bucket in memory
- Idempotency replay to short-circuit repeat work

### Simplicity
- One service
- Prisma for schema + migrations
- Nest modules kept lean
- No external infra (Redis/LLM/Kafka)

### Security/Robustness
- API-key guard
- Input validation (class-validator)
- PII redaction in logs
- Idempotent write path inside DB transaction
- Per-customer locking to avoid double-spend
- 4xx/5xx log levels

## 🤖 Agentic-AI basics (no external LLM; plan + tools + guardrails)

Deterministic agent that:

1. Plans the flow (what info is needed)
2. Calls tools (store functions) with max 2 retries and backoff on retriable errors
3. Falls back to safe decision (review) if tools fail after retries or if inputs look suspicious
4. Emits agentTrace showing plan, tool calls, tries, durations, and the final rationale

### Pseudocode

```typescript
plan = [
  "fetch balance",
  "fetch recent payments (24h)",
  "compute new daily total",
  "compare to threshold",
  "decide"
];

withRetry(2, async () => balance = store.getBalance(customerId));
withRetry(2, async () => recent = store.listRecentPayments(customerId));

const newTotal = sum(recent) + amountCents;

let decision: 'allow' | 'review' | 'block';
const reasons: string[] = [];

if (newTotal > dailyThresholdCents) { 
  decision = 'review'; 
  reasons.push('threshold_exceeded'); 
} else if (balance < amountCents) { 
  decision = 'block';
  reasons.push('insufficient_funds');
} else {
  decision = 'allow';
}

agentTrace = [
  { step: 'plan', detail: '...' },
  { step: 'tool:fetchBalance', ok: true, tries: 1 },
  { step: 'tool:listRecentPayments', ok: true, tries: 1 },
  { step: 'decide', decision, reasons }
];
```

## 🛡️ Guardrails

- Input normalization
- Currency handling (INR only)
- Negative/NaN checks rejected by DTO validation
- Retries only on transient store errors
- Default to review on uncertainty

## 🔒 Defense-in-depth

### PII Redaction
- Headers (authorization, cookie)
- Sensitive body fields (idempotencyKey, card PAN/CVV if present)
- Set-Cookie in responses

### Error Handling
- API returns system codes (stable, audit-friendly)
- UI maps codes to human-readable text
- TODO: Add explicit `userMessage` field for better UX

### Validation
- DTOs with class-validator
- Type checking (UUID, number>0, string)
- Currency whitelist
- Required idempotency key

### Idempotency
- Replay exact prior response for same (idempotencyKey, customerId)
- Set via IdempotencyRepo after successful handler execution

## 🔁 Rate Limiting & Idempotency

### Token Bucket
- In-memory implementation
- Default: 5 req/s per customer (configurable)
- 429 response on rate limit exceeded
- `rateLimitDroppedTotal` counter metric

### Idempotency
- Write-behind after handler success
- Cached payload includes status/decision/trace
- Trade-off: In-memory is process-local (simple, fast)
- For multi-instance: Swap to Redis/Upstash

## 💾 Data Model (Prisma)

```prisma
model CustomerBalance {
  customerId  String   @id
  balanceCents Int
  updatedAt   DateTime @updatedAt
}

model Payment {
  id           String   @id @default(uuid())
  customerId   String
  payeeId      String
  amountCents  Int
  decision     String
  createdAt    DateTime @default(now())
}

model Idempotency {
  customerId   String
  key          String
  responseJson String
  createdAt    DateTime @default(now())
  
  @@id([customerId, key])
}
```

### Concurrency Control
- Transactions with per-customer locks
- Prevents double-spend with concurrent requests

## 🔬 Tests

### Unit Tests (Jest)
- `RateLimitGuard`
  - Allows/Blocks requests
  - Metrics incremented
  - Logger warns on drop
- Idempotency replay
  - Same request returns identical body
- `PaymentsService`
  - Decision paths (allow/review/block)
  - Error scenarios

## ♻️ Trade-offs

### SQLite vs Postgres/MySQL
- **Chose SQLite** for:
  - Zero-infra local dev
  - Low-latency I/O
- **Trade-off**: 
  - Single-writer constraints
  - Process-level file locking
  - Acceptable for assessment scope
- **Migration path**: Swap to Postgres with minimal Prisma changes

### In-memory Rate Limiter vs Redis
- **In-memory**: Simplicity and speed
- **Redis**: Distributed correctness
- **Solution**: Documented extension point for Redis

### Deterministic Agent vs LLM
- **Deterministic Agent**:
  - Repeatable, testable decisions
  - Fewer dependencies
- **LLM Alternative**:
  - More nuanced risk scoring
  - But more complex and less predictable

## 🔧 Configuration

Copy `.env.example` to `.env` and update values:

```env
NODE_ENV=development
PORT=3000
API_KEY=secret-dev-key
DATABASE_URL="file:./prisma/dev.db"
DAILY_THRESHOLD_CENTS=100000
RATE_LIMIT_CAPACITY=5
RATE_LIMIT_REFILL_MS=1000
```

## 📂 Project Layout

```
src/
├── main.ts
├── common/
│   ├── guards/
│   │   ├── api-key.guard.ts
│   │   └── rate-limit.guard.ts
│   ├── interceptors/
│   │   ├── request-id.interceptor.ts
│   │   └── idempotency.interceptor.ts
│   ├── logging/
│   │   └── AppLoggerModule
│   └── metrics/
│       ├── MetricsModule
│       └── metrics.controller.ts
└── payments/
    ├── payments.controller.ts
    ├── payments.service.ts
    ├── dto/
    │   └── decide.dto.ts
    ├── agent/
    │   ├── agent.service.ts
    │   └── types.ts
    └── store/
        ├── prisma.service.ts
        └── repositories.ts

prisma/
├── schema.prisma
└── dev.db  # gitignored

test/
└── unit/
    ├── rate-limit.guard.spec.ts
    └── payments.service.spec.ts
```

## 🧪 Example cURL

```bash
# Set customer ID
CID="550e8400-e29b-41d4-a716-446655440000"

# Make payment decision request
curl -s -X POST http://localhost:3000/payments/decide \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret-dev-key" \
  -H "x-request-id: demo-1" \
  -d '{
    "customerId":"'"$CID"'",
    "payeeId":"m1",
    "amount":10,
    "currency":"INR",
    "idempotencyKey":"unique-key-123"
  }'
```

## ⏳ Time Discipline / TODOs

### High Priority
- [ ] Add explicit `userMessage` field mapped from reasons for UI friendliness
- [ ] Add Redis provider for distributed rate limiting (feature-flagged)

### Metrics & Monitoring
- [ ] Expand metrics (decision counts by outcome, latency histograms)
- [ ] Add Prometheus alerting rules

### Testing
- [ ] Add unit tests for edge cases:
  - Currency mismatch
  - Huge amounts
  - Malformed input data
  - Concurrent requests

### Deployment & Infrastructure
- [ ] Create Dockerfile for containerization
- [ ] Add docker-compose.yml for local development with Prometheus/Grafana
- [ ] Document deployment process

### Future Considerations
- [ ] Migrate from SQLite to Postgres if needed:
  - Update DATABASE_URL
  - Run migrations
  - Update connection pooling settings