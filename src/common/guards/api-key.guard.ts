import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided = req.headers['x-api-key'];
    if (!provided || provided !== process.env.API_KEY) {
      throw new UnauthorizedException('Missing or invalid API key');
    }
    return true;
  }
}
