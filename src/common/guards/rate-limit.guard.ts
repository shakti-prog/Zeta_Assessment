import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { TokenBucketService } from "../rate-limit/token-bucket.service";
import { MetricsService } from "../../metrics/metrics.service";
import { Logger } from "nestjs-pino";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rl: TokenBucketService,
    private readonly ms: MetricsService,
    private readonly logger: Logger
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const res = http.getResponse();

    const customerId =
      (req.body && req.body.customerId) ||
      req.headers["x-customer-id"] ||
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown";

    const ok = this.rl.allow(String(customerId));
    if (!ok) {
      this.ms.rateLimitDroppedTotal.inc();
      this.logger.warn(
        { customerId, path: req.originalUrl },
        "rate-limit: dropped"
      );

      res.setHeader("Retry-After", "1");
      throw new HttpException(
        "Rate limit exceeded for this customer",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    return true;
  }
}
