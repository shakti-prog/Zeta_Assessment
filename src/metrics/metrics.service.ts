import { Injectable } from '@nestjs/common';
import client from 'prom-client';

@Injectable()
export class MetricsService {
  readonly register = new client.Registry();

  readonly httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
  });

  readonly httpLatencyMs = new client.Histogram({
    name: 'http_latency_ms',
    help: 'HTTP request latency in milliseconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [50, 100, 200, 500, 1000, 2000, 5000],
  });

  
  readonly decisionsTotal = new client.Counter({
    name: 'decisions_total',
    help: 'Count of decisions returned',
    labelNames: ['type'] as const, 
  });

  readonly idempotencyHitsTotal = new client.Counter({
    name: 'idempotency_hits_total',
    help: 'Number of idempotency replay hits',
  });

  readonly rateLimitDroppedTotal = new client.Counter({
    name: 'rate_limit_dropped_total',
    help: 'Requests dropped by rate limiting',
  });

  constructor() {
    client.collectDefaultMetrics({ register: this.register });
    this.register.registerMetric(this.httpRequestsTotal);
    this.register.registerMetric(this.httpLatencyMs);
    this.register.registerMetric(this.decisionsTotal);
    this.register.registerMetric(this.idempotencyHitsTotal);
    this.register.registerMetric(this.rateLimitDroppedTotal);
  }

  async getMetricsText(): Promise<string> {
    return this.register.metrics();
  }
}
