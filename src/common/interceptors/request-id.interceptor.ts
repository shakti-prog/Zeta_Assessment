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
    const req = ctx.switchToHttp().getRequest<any>();
    const res = ctx.switchToHttp().getResponse<any>();

    const id = req?.requestId ?? req?.headers?.["x-request-id"] ?? randomUUID();
    req.requestId = id;
    if (!res.getHeader("x-request-id")) res.setHeader("x-request-id", id);

    return next.handle().pipe(
      map((body) => {
        const isJsonObject =
          body !== null &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          !(body instanceof Buffer) &&
          !(typeof (body as any)?.pipe === "function");

        return isJsonObject ? { ...body, requestId: id } : body;
      })
    );
  }
}
