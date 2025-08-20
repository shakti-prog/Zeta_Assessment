import { RequestIdInterceptor } from '../../src/common/interceptors/request-id.interceptor';
import { of, lastValueFrom } from 'rxjs';

describe('RequestIdInterceptor', () => {
  function makeCtx() {
    const headers: Record<string, any> = {};
    const req: any = {};
    const res: any = { setHeader: (k: string, v: any) => (headers[k] = v) };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      getType: () => 'http',
    } as any;
    return { ctx, req, headers };
  }

  it('adds x-request-id header and merges into object body', async () => {
    const interceptor = new RequestIdInterceptor();
    const { ctx, req, headers } = makeCtx();

    const callHandler = { handle: () => of({ hello: 'world' }) } as any;
    const res = await lastValueFrom(interceptor.intercept(ctx, callHandler));

    expect(headers['x-request-id']).toBeDefined();
    expect(req.requestId).toBe(headers['x-request-id']);
    expect(res).toEqual({ hello: 'world', requestId: headers['x-request-id'] });
  });

  it('does not mutate string bodies (e.g., /metrics)', async () => {
    const interceptor = new RequestIdInterceptor();
    const { ctx, headers } = makeCtx();
    const callHandler = { handle: () => of('# HELP something\n# TYPE counter\nx 1') } as any;

    const res = await lastValueFrom(interceptor.intercept(ctx, callHandler));

    expect(headers['x-request-id']).toBeDefined();
    expect(res).toBe('# HELP something\n# TYPE counter\nx 1'); // unchanged string
  });
});
