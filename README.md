# Zeta_Assessment
# Payments Decisioning Service (NestJS + SQLite)

Backend‐heavy solution for the Zeta Assessment. Features: API-key auth, token-bucket rate limiting, idempotency with replay, transactional balance updates, a deterministic “agent” with planning + tool calls (with retries/guardrails), structured logging with PII redaction, and Prometheus metrics.

---

## 🚀 Run locally (2–3 commands)

```bash
npm ci
npx prisma generate
npm run start:dev

🧭 Endpoints

POST /payments/decide
Headers: X-API-Key: <key> (required), optional x-request-id.

Body: { "customerId":"<uuid>", "payeeId":"<string>", "amount": 10, "currency":"INR", "idempotencyKey":"<string>" }

Response (example): { "decision":"allow|review|block", "reasons ["threshold_exceededinsufficient_funds|stub|..."],   // system codes
  "agentTrace":[{"step":"plan","detail":"..."},{"step":"tool:fetchBalance","ok":true,"tries":1}],
  "requestId":"<uuid>"
}

GET /metrics → Prometheus text format (auto-logging ignored for this path)

🏗️ Architecture (ASCII)
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
                          ┌────────────────────────────▼──────────────────────────┐
                          │                      Store (Prisma)                   │
                          │  - getBalance, listRecentPayments, beginTxn+lock,     │
                          │    createPayment, updateBalance, commit/rollback      │
                          │  - IdempotencyRepo (Req→Response cache)               │
                          └───────────────────────────────────────────────────────┘

Observability sidecars:
- Logger (nestjs-pino): redaction, requestId correlation, level mapping, pretty in dev
- Metrics (/metrics): nodejs_* and custom counters (rate-limit drops, decisions, etc.)

⚙️ What I optimized

Latency: in-process SQLite (no network hop), simple agent with deterministic rules and minimal I/O, token bucket in memory, idempotency replay to short-circuit repeat work.

Simplicity: one service, Prisma for schema + migrations, Nest modules kept lean, no external infra (Redis/LLM/Kafka).

Security/robustness: API-key guard, input validation (class-validator), PII redaction in logs, idempotent write path inside DB transaction + per-customer locking to avoid double-spend, 4xx/5xx log levels.


🤖 Agentic-AI basics (no external LLM; plan + tools + guardrails)

Deterministic agent that:

Plans the flow (what info is needed).

Calls tools (store functions) with max 2 retries and backoff on retriable errors.

Falls back to safe decision (review) if tools fail after retries or if inputs look suspicious.

Emits agentTrace showing plan, tool calls, tries, durations, and the final rationale.

Pseudocode:

plan = [
  "fetch balance", "fetch recent payments (24h)",
  "compute new daily total", "compare to threshold", "decide"
];

withRetry(2, async () => balance = store.getBalance(customerId));
withRetry(2, async () => recent = store.listRecentPayments(customerId));

const newTotal = sum(recent) + amountCents;

let decision: 'allow'|'review'|'block';
const reasons: string[] = [];
if (newTotal > dailyThresholdCents) { decision = 'review'; reasons.push('threshold_exceeded'); }
else if (balance < amountCents)     { decision = 'block';  reasons.push('insufficient_funds'); }
else                                { decision = 'allow'; }

agentTrace = [
  { step:'plan', detail: '...' },
  { step:'tool:fetchBalance', ok:true, tries:1 },
  { step:'tool:listRecentPayments', ok:true, tries:1 },
  { step:'decide', decision, reasons }
];


Guardrails: input normalization, currency handling (INR), negative/NaN checks rejected by DTO validation, retries only on transient store errors, default to review on uncertainty.



🛡️ Defense-in-depth touches

Redact PII in logs: headers (authorization, cookie), sensitive body fields (e.g., idempotencyKey, card PAN/CVV if ever present), Set-Cookie in responses.

Separate “user display text” vs “system reasons”:

API returns reasons as system codes (stable, audit-friendly).

The UI should map these codes to human text (to avoid leaking internals).

TODO: add explicit userMessage field if required by reviewers; for now we keep surface minimal.

Validation: DTOs with class-validator ensure correct types (UUID, number>0, string), currency whitelist, and required idempotency key.

Idempotency: replay exact prior response for same (idempotencyKey, customerId) via IdempotencyRepo (set once interceptor sees a successful result).

🔁 Rate limiting & idempotency

Token bucket (in-memory): default 5 req/s per customer (configurable). 429 on drop + counter rateLimitDroppedTotal.

Idempotency: write-behind after handler success; cached payload includes status/decision/trace for replay.

Trade-off: in-memory RL is process-local (simple, fast). For multi-instance deployments, swap to Redis/Upstash.

💾 Data model (Prisma)

CustomerBalance { customerId, balanceCents, updatedAt }

Payment { id, customerId, payeeId, amountCents, decision, createdAt }

Idempotency { customerId, key, responseJson, createdAt }

Transactions + per-customer locks around balance updates + payment insert to avoid double-spend with concurrent requests.

🔬 Tests

Unit tests (Jest):

RateLimitGuard (allows/blocks, metrics inc, logger warns on drop)

Idempotency replay (same request returns identical body)

PaymentsService (decision paths: allow/review/block)

♻️ Trade-offs

SQLite vs Postgres/MySQL: chose SQLite for zero-infra local dev and low-latency I/O. Trade-off: single-writer constraints and process-level file; acceptable for assessment scope. (Swap to Postgres with minimal Prisma changes.)

In-memory rate limiter vs Redis: simplicity and speed vs distributed correctness. Documented extension point to plug Redis if horizontally scaling.

Deterministic agent vs LLM: repeatable, testable decisions; fewer dependencies. Trade-off: less nuanced risk scoring; OK for assignment requirements.

🔧 Configuration

Copy .env.example to .env and tweak:

NODE_ENV=development
PORT=3000
API_KEY=secret-dev-key
DATABASE_URL="file:./prisma/dev.db"
DAILY_THRESHOLD_CENTS=100000
RATE_LIMIT_CAPACITY=5
RATE_LIMIT_REFILL_MS=1000


📂 Project layout (high level)
src/
  main.ts
  common/
    guards/ (api-key.guard.ts, rate-limit.guard.ts)
    interceptors/ (request-id.interceptor.ts, idempotency.interceptor.ts)
    logging/ (AppLoggerModule)
    metrics/ (MetricsModule, /metrics controller)
  payments/
    payments.controller.ts
    payments.service.ts
    dto/decide.dto.ts
    agent/ (agent.service.ts, types.ts)
    store/ (prisma.service.ts, repositories.ts)
prisma/
  schema.prisma
  dev.db (gitignored)
test/
  unit/ (rate-limit.guard.spec.ts, payments.service.spec.ts, ...)

  🧪 Example cURL
CID="550e8400-e29b-41d4-a716-446655440000"
curl -s -X POST http://localhost:3000/payments/decide \
  -H "Content-Type: application/json" -H "X-API-Key: secret-dev-key" \
  -H "x-request-id: demo-1" \
  -d '{"customerId":"'"$CID"'","payeeId":"m1","amount":10,"currency":"INR","idempotencyKey":"


  ⏳ Time discipline / TODOs

 Add explicit userMessage field mapped from reasons for UI friendliness.

 Add Redis provider for distributed rate limiting (feature-flagged).

 Expand metrics (decision counts by outcome, latency histograms).

 More unit tests on edge cases (currency mismatch, huge amounts).

 Dockerfile + compose for Prometheus scraping demo.

 (If required) swap SQLite → Postgres; update DATABASE_URL and run migration.