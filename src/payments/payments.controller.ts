import { Body, Controller, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { DecideDto } from './dto/decide.dto';
import { PaymentsService } from './payments.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('decide')
  @UseGuards(ApiKeyGuard, RateLimitGuard)
  @UseInterceptors(IdempotencyInterceptor)
  async decide(@Body() dto: DecideDto, @Req() req: any) {
    return this.payments.decide(dto, req.requestId);
  }
}
