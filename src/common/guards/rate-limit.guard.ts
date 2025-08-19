import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { TokenBucketService } from "../rate-limit/token-bucket.service";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rl: TokenBucketService) {}

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
      res.setHeader("Retry-After", "1");
      throw new HttpException('Rate limit exceeded for this customer',HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
