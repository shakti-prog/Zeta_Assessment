import { RateLimitGuard } from '../../src/common/guards/rate-limit.guard';

describe('RateLimitGuard', () => {
  function makeCtx(body: any) {
    const req: any = {
      body,
      headers: {},
      ip: '127.0.0.1',
      originalUrl: '/payments/decide',
    };
    const res: any = { setHeader: jest.fn() };
    return {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      getType: () => 'http',
    } as any;
  }

  const mkLogger = () =>
    ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    } as any);

  it('allows when token bucket allows (no warn log, no drop metric)', () => {
    const rl = { allow: jest.fn().mockReturnValue(true) };
    const metrics = { rateLimitDroppedTotal: { inc: jest.fn() } } as any;
    const logger = mkLogger();

    // constructor now: (rateLimiter, metrics, logger)
    const guard = new RateLimitGuard(rl as any, metrics, logger);

    const ok = guard.canActivate(makeCtx({ customerId: 'c1' }));
    expect(ok).toBe(true);

    expect(rl.allow).toHaveBeenCalledWith('c1');
    expect(metrics.rateLimitDroppedTotal.inc).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('blocks when bucket denies; increments metric and logs warn', () => {
    const rl = { allow: jest.fn().mockReturnValue(false) };
    const metrics = { rateLimitDroppedTotal: { inc: jest.fn() } } as any;
    const logger = mkLogger();

    const guard = new RateLimitGuard(rl as any, metrics, logger);

    expect(() => guard.canActivate(makeCtx({ customerId: 'c1' }))).toThrow();

    expect(rl.allow).toHaveBeenCalledWith('c1');
    expect(metrics.rateLimitDroppedTotal.inc).toHaveBeenCalled(); // labels optional
    expect(logger.warn).toHaveBeenCalled(); // message + fields are implementation-specific
  });
});
