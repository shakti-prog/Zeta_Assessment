import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { TokenBucketService } from "../common/rate-limit/token-bucket.service";
import { RateLimitGuard } from "../common/guards/rate-limit.guard";
import { IdempotencyRepo } from "./repos/idempotency.repo";
import { IdempotencyInterceptor } from "./interceptors/idempotency.interceptor";
import { StoreModule } from "../store/ store.module";
import { AgentService } from "./agent/agent.service";
import { ToolsService } from "./agent/tools.service";
import { LocksService } from "../common/locks/lock.service";
import { MetricsModule } from "../metrics/metrics.module";


@Module({
  imports: [StoreModule,MetricsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    TokenBucketService,
    RateLimitGuard,
    IdempotencyRepo,
    IdempotencyInterceptor,
    AgentService,
    ToolsService,
    LocksService,
  ],
})
export class PaymentsModule {}
