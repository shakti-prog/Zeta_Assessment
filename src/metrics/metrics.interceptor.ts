import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, finalize, tap } from "rxjs/operators";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly m: MetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const http = ctx.switchToHttp();
    const req: any = http.getRequest();
    const res = http.getResponse();

    const method = (req.method || "GET").toUpperCase();

    const route = req.route?.path || req.originalUrl || req.url || "unknown";

    const start = process.hrtime.bigint();
    let status = 200;

    return next.handle().pipe(
      tap((body) => {
        status = res.statusCode || 200;

        if (
          body &&
          typeof body === "object" &&
          typeof body.decision === "string"
        ) {
          this.m.decisionsTotal.labels(body.decision).inc();
        }
      }),
      catchError((err) => {
        status =
          typeof err?.getStatus === "function"
            ? err.getStatus()
            : res.statusCode || 500;
        return throwError(() => err);
      }),
      finalize(() => {
        const durMs = Number(process.hrtime.bigint() - start) / 1e6;
        const s = String(status);
        this.m.httpRequestsTotal.labels(method, route, s).inc();
        this.m.httpLatencyMs.labels(method, route, s).observe(durMs);
      })
    );
  }
}
