import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TokenBucketService } from '../common/rate-limit/token-bucket.service'
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { IdempotencyRepo } from './repos/idempotency.repo';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';
import { StoreModule } from '../store/ store.module'; 


@Module({
  imports:[StoreModule],
  controllers: [PaymentsController],
  providers: [PaymentsService,TokenBucketService,RateLimitGuard,IdempotencyRepo,IdempotencyInterceptor,],
})
export class PaymentsModule {}
