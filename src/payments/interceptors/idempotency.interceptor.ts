import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { IdempotencyRepo } from "../repos/idempotency.repo";
import { MetricsService } from "../../metrics/metrics.service";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly repo: IdempotencyRepo,
    private readonly ms: MetricsService
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const http = ctx.switchToHttp();
    const req: any = http.getRequest();

    const body = req.body ?? {};
    const customerId: string | undefined = body.customerId;
    const idempotencyKey: string | undefined = body.idempotencyKey;

    if (!customerId || !idempotencyKey) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.repo
        .find(customerId, idempotencyKey)
        .then((hit) => {
          if (hit?.response) {
            this.ms.idempotencyHitsTotal.inc(); 
            subscriber.next(hit.response);
            subscriber.complete();
            return;
          }
          next
            .handle()
            .pipe(
              mergeMap(async (resp) => {
                const responseBody =
                  resp && typeof resp === "object" && !("requestId" in resp)
                    ? { ...resp, requestId: req.requestId }
                    : resp;

                await this.repo.save(customerId, idempotencyKey, responseBody);
                return responseBody;
              })
            )
            .subscribe({
              next: (val) => subscriber.next(val),
              error: (err) => subscriber.error(err),
              complete: () => subscriber.complete(),
            });
        })
        .catch((err) => subscriber.error(err));
    });
  }
}
