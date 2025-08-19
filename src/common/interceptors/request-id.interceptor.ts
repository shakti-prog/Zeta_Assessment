import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { map } from "rxjs/operators";

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const id = randomUUID();
    req.requestId = id;
    res.setHeader("x-request-id", id);
    return next.handle().pipe(
      map((body) => {
        if (body && typeof body === "object" && "requestId" in body)
          return body;
        return { ...(body ?? {}), requestId: id };
      })
    );
  }
}
