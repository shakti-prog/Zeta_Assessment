import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { IdempotencyRepo } from '../repos/idempotency.repo';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly repo: IdempotencyRepo) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const http = ctx.switchToHttp();
    const req: any = http.getRequest();

    const body = req.body ?? {};
    const customerId: string | undefined = body.customerId;
    const idempotencyKey: string | undefined = body.idempotencyKey;

    // If either is missing, skip idempotency (validation will complain anyway)
    if (!customerId || !idempotencyKey) {
      return next.handle();
    }

    // 1) PRE: replay if we already have a stored response
    return new Observable((subscriber) => {
      this.repo.find(customerId, idempotencyKey)
        .then(hit => {
          if (hit?.response) {
            subscriber.next(hit.response);
            subscriber.complete();
            return;
          }

          // 2) Otherwise pass through to handler and store the result (including requestId)
          next.handle()
            .pipe(
              mergeMap(async (resp) => {
                const responseBody =
                  (resp && typeof resp === 'object' && !('requestId' in resp))
                    ? { ...resp, requestId: req.requestId } // ensure the first run’s requestId is saved
                    : resp;

                await this.repo.save(customerId, idempotencyKey, responseBody);
                return responseBody;
              }),
            )
            .subscribe({
              next: (val) => subscriber.next(val),
              error: (err) => subscriber.error(err),
              complete: () => subscriber.complete(),
            });
        })
        .catch(err => subscriber.error(err));
    });
  }
}
